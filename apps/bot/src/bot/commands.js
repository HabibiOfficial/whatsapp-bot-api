'use strict';

const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

const config = require('../config');
const logger = require('../logger');
const db = require('../db');

function logOut(jid, summary, type) {
  db.query(
    `INSERT INTO message_logs (direction, jid, message, type, status)
     VALUES ('out', $1, $2, $3, 'sent')`,
    [jid, summary, type],
  ).catch((err) => logger.error({ err: err.message }, 'log insert failed'));
}

async function reply(sock, jid, content, originalMsg) {
  await sock.sendMessage(jid, content, { quoted: originalMsg });
  logOut(jid, JSON.stringify(content).slice(0, 200), 'reply');
}

const menuText = ({ name, prefix }) => `╭─❒ *${name}* ❒
│
│ ⚡ *General*
│ ${prefix}menu      - Tampilkan menu
│ ${prefix}ping      - Cek bot
│ ${prefix}info      - Info bot
│
│ 🎨 *Media*
│ ${prefix}sticker   - Reply gambar/video
│ ${prefix}toimg     - Reply stiker → gambar
│
│ 📥 *Downloader*
│ ${prefix}tiktok    <url>
│ ${prefix}ig        <url>
│ ${prefix}yt        <url>
│
│ 👥 *Group* (admin only)
│ ${prefix}kick      @user
│ ${prefix}promote   @user
│ ${prefix}demote    @user
│
╰─────────────❒
Punya pertanyaan? Ketik *${prefix}info*`;

const commands = {
  async menu({ sock, msg, jid }) {
    await reply(sock, jid, { text: menuText({ name: config.botName, prefix: config.botPrefix }) }, msg);
  },

  async ping({ sock, msg, jid }) {
    const t0 = Date.now();
    await reply(sock, jid, { text: `Pong! ${Date.now() - t0}ms` }, msg);
  },

  async info({ sock, msg, jid }) {
    const text = `*${config.botName}*\nPrefix: ${config.botPrefix}\nUptime: ${process.uptime().toFixed(0)}s\nNode: ${process.version}`;
    await reply(sock, jid, { text }, msg);
  },

  async sticker({ sock, msg, jid }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted
      ? { message: quoted, key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId } }
      : msg;

    const m = target.message || {};
    if (!m.imageMessage && !m.videoMessage) {
      return reply(sock, jid, { text: 'Reply gambar/video dengan caption !sticker' }, msg);
    }

    const buffer = await downloadMediaMessage(target, 'buffer', {});
    const sticker = new Sticker(buffer, {
      pack: config.botName,
      author: 'WhatsApp Bot API',
      type: StickerTypes.FULL,
      quality: 60,
    });
    const out = await sticker.toBuffer();
    await sock.sendMessage(jid, { sticker: out }, { quoted: msg });
    logOut(jid, '[sticker]', 'sticker');
  },

  async toimg({ sock, msg, jid }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted?.stickerMessage) {
      return reply(sock, jid, { text: 'Reply stiker dengan !toimg' }, msg);
    }
    const target = {
      message: quoted,
      key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId },
    };
    const buffer = await downloadMediaMessage(target, 'buffer', {});
    await sock.sendMessage(jid, { image: buffer }, { quoted: msg });
    logOut(jid, '[image]', 'image');
  },

  async tiktok({ sock, msg, jid, args }) {
    if (!args) return reply(sock, jid, { text: `Penggunaan: ${config.botPrefix}tiktok <url>` }, msg);
    try {
      const { data } = await axios.get('https://www.tikwm.com/api/', {
        params: { url: args, hd: 1 },
        timeout: 15000,
      });
      const item = data?.data;
      if (!item?.play) throw new Error('video tidak ditemukan');
      await sock.sendMessage(
        jid,
        { video: { url: item.play }, caption: item.title || 'TikTok' },
        { quoted: msg },
      );
    } catch (err) {
      logger.error({ err: err.message }, 'tiktok download failed');
      await reply(sock, jid, { text: `Gagal download TikTok: ${err.message}` }, msg);
    }
  },

  async ig({ sock, msg, jid, args }) {
    if (!args) return reply(sock, jid, { text: `Penggunaan: ${config.botPrefix}ig <url>` }, msg);
    await reply(
      sock,
      jid,
      {
        text:
          'Instagram downloader perlu API eksternal. Silakan tambahkan IG_API_URL di .env atau ganti implementasinya di src/bot/commands.js (command ig).',
      },
      msg,
    );
  },

  async yt({ sock, msg, jid, args }) {
    if (!args) return reply(sock, jid, { text: `Penggunaan: ${config.botPrefix}yt <url>` }, msg);
    await reply(
      sock,
      jid,
      {
        text:
          'YouTube downloader belum dikonfigurasi. Tambahkan ytdl-core / API eksternal sesuai kebutuhan di src/bot/commands.js (command yt).',
      },
      msg,
    );
  },

  async kick({ sock, msg, jid, args }) {
    if (!jid.endsWith('@g.us')) return reply(sock, jid, { text: 'Hanya bisa di group' }, msg);
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length === 0) return reply(sock, jid, { text: 'Mention user yang mau di-kick' }, msg);
    try {
      await sock.groupParticipantsUpdate(jid, mentioned, 'remove');
      await reply(sock, jid, { text: `Removed ${mentioned.length} user` }, msg);
    } catch (err) {
      await reply(sock, jid, { text: `Gagal kick: ${err.message}` }, msg);
    }
  },

  async promote({ sock, msg, jid }) {
    if (!jid.endsWith('@g.us')) return reply(sock, jid, { text: 'Hanya bisa di group' }, msg);
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length === 0) return reply(sock, jid, { text: 'Mention user yang mau di-promote' }, msg);
    try {
      await sock.groupParticipantsUpdate(jid, mentioned, 'promote');
      await reply(sock, jid, { text: 'Promoted!' }, msg);
    } catch (err) {
      await reply(sock, jid, { text: `Gagal promote: ${err.message}` }, msg);
    }
  },

  async demote({ sock, msg, jid }) {
    if (!jid.endsWith('@g.us')) return reply(sock, jid, { text: 'Hanya bisa di group' }, msg);
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length === 0) return reply(sock, jid, { text: 'Mention user yang mau di-demote' }, msg);
    try {
      await sock.groupParticipantsUpdate(jid, mentioned, 'demote');
      await reply(sock, jid, { text: 'Demoted!' }, msg);
    } catch (err) {
      await reply(sock, jid, { text: `Gagal demote: ${err.message}` }, msg);
    }
  },
};

commands.help = commands.menu;
commands.start = commands.menu;

module.exports = commands;
