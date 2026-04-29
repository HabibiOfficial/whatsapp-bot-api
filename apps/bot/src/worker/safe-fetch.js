'use strict';

/**
 * SSRF-safe URL fetcher.
 *
 * Rejects non-http(s) schemes, then DNS-resolves the hostname and rejects any
 * address that lies in a private/loopback/link-local/CGNAT range. Network call
 * uses axios.get with a small timeout and bounded response size.
 */

const dns = require('dns').promises;
const net = require('net');
const axios = require('axios');

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB hard cap
const TIMEOUT_MS = 30_000;

const DENY_V4 = [
  ['0.0.0.0',         8],
  ['10.0.0.0',        8],
  ['100.64.0.0',     10], // CGNAT
  ['127.0.0.0',       8],
  ['169.254.0.0',    16], // link-local / cloud metadata
  ['172.16.0.0',     12],
  ['192.0.0.0',      24],
  ['192.0.2.0',      24],
  ['192.168.0.0',    16],
  ['198.18.0.0',     15],
  ['198.51.100.0',   24],
  ['203.0.113.0',    24],
  ['224.0.0.0',       4],
  ['240.0.0.0',       4],
  ['255.255.255.255',32],
];

function ipv4ToInt(ip) {
  const parts = ip.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inV4Cidr(ip, base, bits) {
  const ipi = ipv4ToInt(ip);
  const bsi = ipv4ToInt(base);
  if (ipi == null || bsi == null) return false;
  if (bits === 0) return true;
  const mask = (~((1 << (32 - bits)) - 1)) >>> 0;
  return (ipi & mask) === (bsi & mask);
}

function isPrivateAddress(addr) {
  if (net.isIPv4(addr)) {
    return DENY_V4.some(([base, bits]) => inV4Cidr(addr, base, bits));
  }
  if (net.isIPv6(addr)) {
    const lower = addr.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('::ffff:')) {
      const v4 = lower.slice(7);
      if (net.isIPv4(v4)) return DENY_V4.some(([b, bits]) => inV4Cidr(v4, b, bits));
    }
    return false;
  }
  return true; // unknown -> deny
}

async function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('invalid url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`disallowed scheme: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('credentials in url not allowed');
  }
  const host = parsed.hostname;
  if (!host) throw new Error('missing host');

  // If hostname is a literal IP, validate directly. Otherwise resolve A/AAAA.
  let addrs = [];
  if (net.isIP(host)) {
    addrs = [host];
  } else {
    try {
      const r = await dns.lookup(host, { all: true });
      addrs = r.map((x) => x.address);
    } catch {
      throw new Error(`dns resolution failed for ${host}`);
    }
  }
  if (addrs.length === 0) throw new Error('no addresses resolved');
  for (const a of addrs) {
    if (isPrivateAddress(a)) {
      throw new Error(`refusing private/internal address: ${a}`);
    }
  }
}

async function safeFetchBuffer(url) {
  await assertSafeUrl(url);
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: TIMEOUT_MS,
    maxContentLength: MAX_BYTES,
    maxBodyLength: MAX_BYTES,
    maxRedirects: 0, // any redirect would re-introduce SSRF risk; rely on direct URL only
    validateStatus: (s) => s >= 200 && s < 300,
  });
  return Buffer.from(res.data);
}

module.exports = { safeFetchBuffer, assertSafeUrl, isPrivateAddress };
