# Deploy: Pterodactyl (Bot worker + Dashboard)

Bot worker (Baileys + dashboard admin) butuh proses Node.js yang jalan **24/7**. Pterodactyl panel cocok karena memang dirancang untuk ini.

## 1. Setup server di Pterodactyl

1. Login ke panel Pterodactyl kamu (bukan Pterodactyl-nya Devin — yang punya kamu / hosting kamu).
2. Klik **Create Server**.
3. **Egg:** pilih **NodeJS** (atau Generic / NodeJS Bot — tergantung host).
4. **Resources:**
   - RAM: minimal **512 MB** (rekomendasi 1 GB)
   - CPU: 50% cukup
   - Disk: 1-2 GB
5. **Startup options:**
   - **Node version:** `20` atau lebih baru (jangan pakai 16/18)
   - **Startup command:** `npm install && npm start` (kalau egg-nya nanya)

## 2. Upload kode

**Opsi A — via Git (rekomendasi):**

Buka tab **Console** di Pterodactyl, jalankan:

```bash
git clone https://github.com/HabibiOfficial/whatsapp-bot-api .
cd apps/bot
```

**Opsi B — via SFTP:**

1. Download repo dari GitHub sebagai ZIP.
2. Connect ke server pakai SFTP (kredensial dari Pterodactyl → tab Files → "SFTP Details").
3. Upload semua file ke root server.

## 3. Set environment variables

Di Pterodactyl, biasanya ada tab **Startup** atau **Variables**. Tambah:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | (dari Neon, sama persis dengan yang dipakai Vercel) |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | (password aman, mis. dari `openssl rand -hex 16`) |
| `JWT_SECRET` | (random string panjang, mis. `openssl rand -hex 32`) |
| `PORT` | `3000` (atau port yang Pterodactyl alokasi) |

Kalau panel kamu nggak punya UI environment variable, bisa juga via `.env`:

```bash
cp apps/bot/.env.example apps/bot/.env
nano apps/bot/.env
# isi semua var di atas
```

## 4. Install & start

Di console Pterodactyl:

```bash
cd apps/bot
npm install --production --no-optional
npm start
```

Output yang diharapkan:
```
{"level":30,"msg":"Postgres pool ready","host":"ep-xxxxx-pooler.aws.neon.tech"}
{"level":30,"msg":"API server listening","host":"0.0.0.0","port":3000}
{"level":30,"msg":"worker started","pollMs":1000,"batch":10}
{"level":30,"msg":"QR code generated"}
```

## 5. Akses dashboard & scan QR

Di Pterodactyl, biasanya server kamu punya IP publik + port allocation (mis. `123.45.67.89:25500`). Kalau panel kamu meng-expose port `3000` ke port publik tertentu, buka:

```
http://YOUR-SERVER-IP:PORT/dashboard
```

Login pakai `ADMIN_USERNAME` + `ADMIN_PASSWORD`. Kamu akan lihat QR code → scan dari WhatsApp di HP (Settings → Linked Devices → Link a Device).

Setelah scan: status berubah jadi `connected`. Cek:

```bash
curl http://YOUR-SERVER-IP:PORT/api/status/public
# {"status":"connected","connected":true}
```

## 6. Buat API key

Di dashboard → tab **API Keys** → klik **Buat key baru** → copy `wba_xxxxxxxx`. Pakai key ini di header `x-api-key` saat hit endpoint Vercel.

## 7. Restart policy

Pterodactyl biasanya auto-restart kalau process crash. Pastikan **Auto Restart on Crash** aktif. Bot akan auto-reconnect ke WhatsApp (dengan exponential backoff) tanpa perlu intervention.

## Troubleshooting

- **`Missing required env var: DATABASE_URL`** — env var nggak ke-set. Cek ulang tab Variables di Pterodactyl.
- **`Postgres pool ready` tapi langsung error** — `DATABASE_URL` salah ketik. Pastikan pakai connection string yang sama dengan Vercel (pooled URL Neon).
- **QR generate ulang terus** — kemungkinan firewall/IP block dari WhatsApp. Coba VPS region lain atau tunggu 5-10 menit.
- **`session expired` setelah restart** — folder `auth_info_baileys/` ke-wipe. Pastikan Pterodactyl-mu nggak menghapus folder kerja saat restart, atau set `SESSION_DIR=/persistent/path/auth_info_baileys`.
- **Bot connected tapi pesan dari Vercel nggak terkirim** — cek log worker di console (`worker tick error`?). Sering kali karena `DATABASE_URL` di bot beda dengan di Vercel.

## Resource usage

- RAM: ~150-300 MB idle, naik ~50 MB per group besar
- CPU: <5% idle, spike saat encode sticker (beberapa detik)
- Disk: tergantung session — biasanya <100 MB
