'use strict';

const config = require('../config');
const logger = require('../logger');
const db = require('../db');
const commands = require('./commands');

async function logMessage(direction, jid, message, type, status, error) {
  try {
    await db.query(
      `INSERT INTO message_logs (direction, jid, message, type, status, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [direction, jid, message, type, status, error],
    );
  } catch (err) {
    logger.error({ err: err.message }, 'logMessage failed');
  }
}

function extractText(msg) {
  const m = msg.message || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  );
}

function extractType(msg) {
  if (!msg.message) return 'unknown';
  return Object.keys(msg.message)[0];
}

async function onMessages(sock, payload) {
  const messages = payload.messages || [];
  for (const msg of messages) {
    if (!msg.message) continue;
    if (msg.key.fromMe) continue;

    const jid = msg.key.remoteJid;
    if (!jid) continue;

    const text = extractText(msg).trim();
    const type = extractType(msg);

    await logMessage('in', jid, text, type, 'received', null);

    if (text.startsWith(config.botPrefix)) {
      const without = text.slice(config.botPrefix.length).trim();
      const [cmd, ...rest] = without.split(/\s+/);
      const args = rest.join(' ');
      const handlerFn = commands[cmd?.toLowerCase()];

      if (handlerFn) {
        try {
          await handlerFn({ sock, msg, jid, args, text });
        } catch (err) {
          logger.error({ err, cmd }, 'command failed');
          await sock.sendMessage(jid, { text: `Error: ${err.message}` });
        }
      }
      continue;
    }

    await maybeAutoReply(sock, jid, text);
  }
}

async function maybeAutoReply(sock, jid, text) {
  if (!text) return;
  let rules;
  try {
    const r = await db.query(
      'SELECT pattern, response, match_type FROM auto_replies WHERE enabled = TRUE',
    );
    rules = r.rows;
  } catch (err) {
    logger.error({ err: err.message }, 'autoreply load failed');
    return;
  }

  const lower = text.toLowerCase();
  for (const row of rules) {
    const pattern = row.pattern.toLowerCase();
    let match = false;
    switch (row.match_type) {
      case 'exact': match = lower === pattern; break;
      case 'startsWith': match = lower.startsWith(pattern); break;
      case 'regex':
        try { match = new RegExp(row.pattern, 'i').test(text); }
        catch { match = false; }
        break;
      case 'contains':
      default: match = lower.includes(pattern);
    }
    if (match) {
      await sock.sendMessage(jid, { text: row.response });
      await logMessage('out', jid, row.response, 'autoreply', 'sent', null);
      return;
    }
  }
}

module.exports = { onMessages, logMessage };
