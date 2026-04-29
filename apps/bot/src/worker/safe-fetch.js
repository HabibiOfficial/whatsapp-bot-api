'use strict';

/**
 * SSRF-safe URL fetcher.
 *
 * Resolves the hostname once, validates every returned address against a
 * private/loopback/CGNAT/link-local denylist, then forces axios to connect to
 * exactly that pre-validated address (via a per-request agent.lookup) so a
 * subsequent DNS lookup cannot rebind to an internal IP. Also caps response
 * size, disables redirects (which would re-introduce the rebind risk), and
 * uses a bounded timeout.
 */

const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
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

async function resolveAndValidate(host) {
  let addrs;
  if (net.isIP(host)) {
    addrs = [{ address: host, family: net.isIPv6(host) ? 6 : 4 }];
  } else {
    try {
      addrs = await dns.lookup(host, { all: true });
    } catch {
      throw new Error(`dns resolution failed for ${host}`);
    }
  }
  if (!addrs || addrs.length === 0) throw new Error('no addresses resolved');
  for (const a of addrs) {
    if (isPrivateAddress(a.address)) {
      throw new Error(`refusing private/internal address: ${a.address}`);
    }
  }
  return addrs[0]; // pin to first validated address
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
  if (!parsed.hostname) throw new Error('missing host');
  return { parsed, pinned: await resolveAndValidate(parsed.hostname) };
}

function buildPinnedAgent(parsed, pinned) {
  // Custom lookup ignores hostname and always returns the pre-validated IP.
  // Handle both callback signatures: when options.all is true, callback wants
  // an array of {address, family}; otherwise the (address, family) form.
  const lookup = (_hostname, opts, cb) => {
    const callback = typeof opts === 'function' ? opts : cb;
    const options = typeof opts === 'function' ? {} : opts || {};
    if (options.all) {
      callback(null, [{ address: pinned.address, family: pinned.family }]);
    } else {
      callback(null, pinned.address, pinned.family);
    }
  };
  if (parsed.protocol === 'https:') {
    return new https.Agent({ keepAlive: false, lookup });
  }
  return new http.Agent({ keepAlive: false, lookup });
}

async function safeFetchBuffer(url) {
  const { parsed, pinned } = await assertSafeUrl(url);
  const agent = buildPinnedAgent(parsed, pinned);
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: TIMEOUT_MS,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      maxRedirects: 0,
      validateStatus: (s) => s >= 200 && s < 300,
      httpAgent: agent,
      httpsAgent: agent,
      // SNI/Host header still uses the original hostname; the pinned IP is
      // applied at the socket layer via the agent's `lookup`.
    });
    return Buffer.from(res.data);
  } finally {
    agent.destroy();
  }
}

module.exports = { safeFetchBuffer, assertSafeUrl, isPrivateAddress };
