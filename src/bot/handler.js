'use strict';

const config = require('../config');
const logger = require('../logger');
const db = require('../db');
const commands = require('./commands');

const insertLog = db.prepare(
  `INSERT INTO message_logs (direction, jid, message, type, status)
   VALUES (?, ?, ?, ?, ?)`,
);

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

    insertLog.run('in', jid, text, type, 'received');

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
  const rows = db
    .prepare('SELECT pattern, response, match_type FROM auto_replies WHERE enabled = 1')
    .all();
  const lower = text.toLowerCase();

  for (const row of rows) {
    const pattern = row.pattern.toLowerCase();
    let match = false;
    switch (row.match_type) {
      case 'exact':
        match = lower === pattern;
        break;
      case 'startsWith':
        match = lower.startsWith(pattern);
        break;
      case 'regex':
        try {
          match = new RegExp(row.pattern, 'i').test(text);
        } catch {
          match = false;
        }
        break;
      case 'contains':
      default:
        match = lower.includes(pattern);
        break;
    }
    if (match) {
      await sock.sendMessage(jid, { text: row.response });
      insertLog.run('out', jid, row.response, 'autoreply', 'sent');
      return;
    }
  }
}

module.exports = { onMessages };
