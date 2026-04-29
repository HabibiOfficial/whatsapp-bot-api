# WhatsApp Bot API

WhatsApp bot lengkap dengan **dashboard web** dan **REST API** + sistem **API key**.

Stack: **Node.js + Express + Baileys + SQLite** (zero-build, deployable di VPS murah / single VM).

---

## Fitur

### Bot
- Login lewat **QR code** (scan via dashboard, sesi tersimpan di disk)
- **Command handler** dengan prefix konfigurable (default `!`)
- **Sticker maker** (gambar/video → stiker, atau stiker → gambar)
- **Downloader** TikTok (via tikwm.com), placeholder IG/YT yang bisa kamu isi sesuai kebutuhan
- **Group management**: kick, promote, demote
- **Auto-reply** rule based (contains / exact / startsWith / regex) — dikelola dari dashboard
- Reconnect otomatis dengan exponential backoff
- Semua pesan masuk/keluar dilog ke SQLite

### Dashboard
- Login admin tunggal (username + password dari `.env`)
- QR code live untuk pairing
- Manajemen **API key**: buat, enable/disable, hapus, set rate limit per-key
- Manajemen **auto-reply rules**
- Statistik: jumlah pesan masuk/keluar, key aktif, dll
- Log pesan terbaru

### REST API
- Otentikasi via header `x-api-key` (atau query `?apikey=`)
- Rate limit per API key (configurable per key)
- Endpoints:
  - `POST /api/messages/send-text` — kirim teks
  - `POST /api/messages/send-image` — kirim gambar dari URL
  - `POST /api/messages/send-document` — kirim dokumen dari URL
  - `POST /api/messages/broadcast` — kirim ke banyak nomor
  - `GET  /api/messages/check-number` — cek nomor terdaftar di WA
  - `GET  /api/status/public` — status koneksi (tanpa auth)
  - `GET  /api/health` — healthcheck

Semua endpoint admin (`/api/keys`, `/api/autoreplies`, `/api/status/*` selain `/public`) butuh login dashboard (cookie `admin_token`).

---

## Quick start

```bash
# 1. Clone & install
git clone https://github.com/HabibiOfficial/whatsapp-bot-api.git
cd whatsapp-bot-api
npm install

# 2. Konfigurasi
cp .env.example .env
# edit .env (minimal: ADMIN_PASSWORD dan JWT_SECRET)

# 3. Jalankan
npm start
```

Buka `http://localhost:3000/dashboard`, login dengan kredensial dari `.env`, lalu **scan QR code** dengan WhatsApp di HP kamu (Settings → Linked Devices → Link a Device).

Setelah connected, kamu bisa:
- Buat API key di tab **API Keys**
- Tes kirim pesan via REST API (lihat contoh di bawah)

---

## Konfigurasi `.env`

| Variable | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port server |
| `HOST` | `0.0.0.0` | Bind address |
| `ADMIN_USERNAME` | `admin` | Username dashboard |
| `ADMIN_PASSWORD` | `changeme` | **GANTI sebelum production** |
| `JWT_SECRET` | — | String random panjang untuk session |
| `DB_PATH` | `./data.db` | Path SQLite |
| `SESSION_DIR` | `./auth_info_baileys` | Folder sesi Baileys |
| `BOT_NAME` | `WinaBot` | Nama bot (muncul di stiker, dll) |
| `BOT_PREFIX` | `!` | Prefix command |
| `LOG_LEVEL` | `info` | `trace`/`debug`/`info`/`warn`/`error` |

---

## Contoh penggunaan REST API

### Kirim teks

```bash
curl -X POST http://localhost:3000/api/messages/send-text \
  -H "x-api-key: wba_xxxxxxxxxxxx" \
  -H "content-type: application/json" \
  -d '{"to": "6281234567890", "message": "Halo dari API!"}'
```

Format `to` boleh:
- Nomor saja: `"6281234567890"` (otomatis jadi `6281234567890@s.whatsapp.net`)
- JID lengkap: `"6281234567890@s.whatsapp.net"` atau `"123-456@g.us"` untuk group

### Kirim gambar

```bash
curl -X POST http://localhost:3000/api/messages/send-image \
  -H "x-api-key: wba_xxxxxxxxxxxx" \
  -H "content-type: application/json" \
  -d '{
    "to": "6281234567890",
    "url": "https://picsum.photos/600",
    "caption": "Random image"
  }'
```

### Broadcast

```bash
curl -X POST http://localhost:3000/api/messages/broadcast \
  -H "x-api-key: wba_xxxxxxxxxxxx" \
  -H "content-type: application/json" \
  -d '{
    "recipients": ["6281111111111", "6282222222222"],
    "message": "Pengumuman!",
    "delayMs": 1500
  }'
```

`delayMs` adalah jeda antar nomor (rekomendasi 1000–3000 ms untuk menghindari rate-limit WhatsApp).

### Cek nomor

```bash
curl "http://localhost:3000/api/messages/check-number?number=6281234567890" \
  -H "x-api-key: wba_xxxxxxxxxxxx"
```

---

## Bot commands (default prefix `!`)

| Command | Keterangan |
|---|---|
| `!menu` | Menampilkan daftar command |
| `!ping` | Cek bot hidup |
| `!info` | Info bot & uptime |
| `!sticker` | Reply gambar/video → stiker |
| `!toimg` | Reply stiker → gambar |
| `!tiktok <url>` | Download video TikTok tanpa watermark |
| `!ig <url>` | (placeholder — isi sendiri sesuai API yang kamu pakai) |
| `!yt <url>` | (placeholder — isi sendiri sesuai API yang kamu pakai) |
| `!kick @user` | Kick user dari group (admin only) |
| `!promote @user` | Promote ke admin |
| `!demote @user` | Demote dari admin |

---

## Struktur folder

```
src/
├── index.js              # entry point
├── config.js             # env loader
├── db.js                 # SQLite + schema
├── logger.js             # pino logger
├── bot/
│   ├── index.js          # Baileys socket lifecycle
│   ├── handler.js        # incoming message dispatcher
│   └── commands.js       # command handlers
├── api/
│   ├── server.js         # express app
│   ├── middleware.js     # adminAuth + apiKeyAuth
│   └── routes/
│       ├── auth.js
│       ├── apikeys.js
│       ├── messages.js
│       ├── status.js
│       └── autoreplies.js
└── public/               # dashboard (HTML/CSS/JS, no build)
    ├── login.html
    ├── dashboard.html
    ├── style.css
    └── app.js
```

---

## Deployment

### Run as service (systemd)

```ini
# /etc/systemd/system/whatsapp-bot.service
[Unit]
Description=WhatsApp Bot API
After=network.target

[Service]
WorkingDirectory=/opt/whatsapp-bot-api
ExecStart=/usr/bin/node src/index.js
Restart=always
User=www-data
EnvironmentFile=/opt/whatsapp-bot-api/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now whatsapp-bot
sudo journalctl -u whatsapp-bot -f
```

### Reverse proxy (nginx)

```nginx
server {
  listen 443 ssl http2;
  server_name bot.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

---

## Catatan & disclaimer

- **Baileys = unofficial library**. WhatsApp bisa memblokir akun yang dianggap spam. Jangan broadcast ke nomor yang tidak punya hubungan dengan kamu, dan kasih jeda yang wajar.
- **Untuk production / business**, pertimbangkan migrasi ke [WhatsApp Cloud API resmi](https://developers.facebook.com/docs/whatsapp/cloud-api).
- Sesi Baileys disimpan di folder `auth_info_baileys/` (sudah di-`.gitignore`). Backup folder ini kalau mau migrasi server tanpa scan QR ulang.
- Database SQLite (`data.db`) menyimpan API key, log pesan, dan auto-reply rules.

---

## Lisensi

MIT
