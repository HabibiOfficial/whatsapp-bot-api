'use strict';

const fs = require('fs');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');

const config = require('../config');
const logger = require('../logger');
const db = require('../db');
const handler = require('./handler');

const state = {
  sock: null,
  status: 'disconnected',
  qr: null,
  qrDataUrl: null,
  user: null,
  startedAt: null,
  reconnectAttempts: 0,
};

async function syncState() {
  try {
    await db.query(
      `UPDATE bot_state SET status=$1, user_jid=$2, user_name=$3, qr_data_url=$4,
         started_at=$5, updated_at=NOW() WHERE id=1`,
      [
        state.status,
        state.user?.id || null,
        state.user?.name || null,
        state.qrDataUrl,
        state.startedAt,
      ],
    );
  } catch (err) {
    logger.error({ err: err.message }, 'syncState failed');
  }
}

async function start() {
  if (!fs.existsSync(config.sessionDir)) {
    fs.mkdirSync(config.sessionDir, { recursive: true });
  }

  const { state: authState, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: authState,
    browser: Browsers.ubuntu(config.botName),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  state.sock = sock;
  state.status = 'connecting';
  await syncState();

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      state.qr = qr;
      try {
        state.qrDataUrl = await QRCode.toDataURL(qr);
      } catch (err) {
        logger.error({ err }, 'failed rendering QR code');
      }
      state.status = 'qr';
      await syncState();
      logger.info('QR code generated');
    }

    if (connection === 'open') {
      state.status = 'connected';
      state.qr = null;
      state.qrDataUrl = null;
      state.user = sock.user;
      state.startedAt = new Date().toISOString();
      state.reconnectAttempts = 0;
      await syncState();
      logger.info({ user: sock.user?.id }, 'WhatsApp connected');
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      state.status = loggedOut ? 'logged_out' : 'disconnected';
      state.user = null;
      await syncState();
      logger.warn({ code, loggedOut }, 'WhatsApp connection closed');

      if (loggedOut) {
        try {
          fs.rmSync(config.sessionDir, { recursive: true, force: true });
          fs.mkdirSync(config.sessionDir, { recursive: true });
        } catch (err) {
          logger.error({ err }, 'failed clearing session dir');
        }
      }

      const delay = Math.min(30000, 2000 * 2 ** state.reconnectAttempts);
      state.reconnectAttempts += 1;
      setTimeout(() => start().catch((err) => logger.error({ err }, 'restart failed')), delay);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      await handler.onMessages(sock, m);
    } catch (err) {
      logger.error({ err }, 'message handler error');
    }
  });

  return sock;
}

function getState() {
  return {
    status: state.status,
    user: state.user ? { id: state.user.id, name: state.user.name } : null,
    qrDataUrl: state.qrDataUrl,
    startedAt: state.startedAt,
  };
}

function getSocket() {
  return state.sock;
}

async function logout() {
  if (state.sock) {
    try { await state.sock.logout(); }
    catch (err) { logger.error({ err }, 'logout error'); }
  }
  try {
    fs.rmSync(config.sessionDir, { recursive: true, force: true });
    fs.mkdirSync(config.sessionDir, { recursive: true });
  } catch (err) {
    logger.error({ err }, 'failed clearing session dir');
  }
  state.status = 'disconnected';
  state.user = null;
  state.qr = null;
  state.qrDataUrl = null;
  await syncState();
}

module.exports = { start, getState, getSocket, logout };
