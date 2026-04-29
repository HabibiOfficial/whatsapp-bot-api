'use strict';

const fs = require('fs');
const path = require('path');
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

async function start() {
  if (!fs.existsSync(config.sessionDir)) {
    fs.mkdirSync(config.sessionDir, { recursive: true });
  }

  const { state: authState, saveCreds } = await useMultiFileAuthState(
    config.sessionDir,
  );
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
      logger.info('QR code generated, scan via dashboard');
    }

    if (connection === 'open') {
      state.status = 'connected';
      state.qr = null;
      state.qrDataUrl = null;
      state.user = sock.user;
      state.startedAt = new Date().toISOString();
      state.reconnectAttempts = 0;
      logger.info({ user: sock.user?.id }, 'WhatsApp connected');
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      state.status = loggedOut ? 'logged_out' : 'disconnected';
      state.user = null;
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
    user: state.user
      ? { id: state.user.id, name: state.user.name }
      : null,
    qrDataUrl: state.qrDataUrl,
    startedAt: state.startedAt,
  };
}

function getSocket() {
  return state.sock;
}

async function logout() {
  if (state.sock) {
    try {
      await state.sock.logout();
    } catch (err) {
      logger.error({ err }, 'logout error');
    }
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
}

module.exports = { start, getState, getSocket, logout, _path: path };
