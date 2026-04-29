'use strict';

/**
 * Lightweight URL validation for Vercel-side input. The authoritative SSRF
 * check happens on the bot worker (since that is where the fetch occurs and
 * DNS resolution must be done at fetch time). This catches obvious offenders
 * early so we don't even queue them.
 */

function validateExternalUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: 'invalid url' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'only http and https are allowed' };
  }
  if (u.username || u.password) {
    return { ok: false, error: 'credentials in url not allowed' };
  }
  // Strip IPv6 brackets if present so the checks below see the bare address.
  let host = u.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '::' ||
    host === '169.254.169.254' || // cloud metadata
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { ok: false, error: 'private/internal host not allowed' };
  }
  // Catch obvious literal private IPv4 ranges before queueing.
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    return { ok: false, error: 'private/internal host not allowed' };
  }
  // Reject any IPv4-mapped IPv6 form (dotted, hex, fully-expanded). The
  // authoritative check happens on the worker; this is just early defense.
  if (/(:|^)(0+:){0,4}0*ffff(:|$)/i.test(host) || host.includes('::ffff:')) {
    return { ok: false, error: 'ipv4-mapped ipv6 address not allowed' };
  }
  return { ok: true };
}

module.exports = { validateExternalUrl };
