'use strict';

function normalizeJid(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (s.includes('@')) return s;
  const digits = s.replace(/\D/g, '');
  if (!digits) return null;
  return `${digits}@s.whatsapp.net`;
}

module.exports = { normalizeJid };
