# WhatsApp Bot API

Bot WhatsApp (Baileys) + REST API gateway via Vercel + dashboard admin, dengan Postgres shared (Neon) sebagai jembatan.

```
[ Public client ]
        │ POST /api/messages/send-text
        ▼
┌──────────────────┐         ┌───────────────────────┐
│  Vercel          │  Neon   │  Bot worker           │
│  apps/web/       │ ◄──────►│  apps/bot/            │
│  - landing page  │ Postgres│  - Baileys (WA)       │
│  - REST API      │         │  - Dashboard admin    │
│  - API key auth  │         │  - Worker polling DB  │
└──────────────────┘         └───────────────────────┘
```

- **`apps/web/`** — di-deploy ke **Vercel**. Public REST API + landing page. Stateless. Menulis `outgoing_messages` ke Postgres.
- **`apps/bot/`** — di-deploy ke **Pterodactyl/VPS** (proses 24/7). Baileys connection, dashboard admin, worker yang baca `outgoing_messages` dari Postgres dan kirim via WA.
- **`packages/db/`** — schema Postgres (DDL) + helper migrasi.

## Quick start

### 1. Siapkan database (Neon)

Bikin akun gratis di https://neon.tech, copy `DATABASE_URL` dari project settings. Lalu jalankan:

```bash
DATABASE_URL='postgresql://...' node packages/db/migrate.js
```

### 2. Deploy `apps/web/` ke Vercel

Lihat [`docs/DEPLOY-VERCEL.md`](docs/DEPLOY-VERCEL.md). TL;DR:

1. Connect repo di https://vercel.com → pilih root **`apps/web`**.
2. Set env var `DATABASE_URL` (sama persis dengan Neon).
3. Deploy.

### 3. Deploy `apps/bot/` ke Pterodactyl

Lihat [`docs/DEPLOY-PTERODACTYL.md`](docs/DEPLOY-PTERODACTYL.md). TL;DR:

```bash
cd apps/bot
cp .env.example .env
# isi DATABASE_URL, ADMIN_PASSWORD, JWT_SECRET
npm install
npm start
```

Buka `http://server-ip:3000/dashboard`, login admin, scan QR.

### 4. Buat API key & test

Dari dashboard bot → tab "API Keys" → "Buat key baru" → copy key (`wba_xxxxxxxx`).

Test dari terminal:

```bash
curl -X POST https://YOUR-PROJECT.vercel.app/api/messages/send-text \
  -H "Content-Type: application/json" \
  -H "x-api-key: wba_xxxxxxxx" \
  -d '{"to": "6281234567890", "message": "Halo dari REST API!"}'
```

## Fitur

### Bot (`apps/bot/`)

- Baileys WA connection (QR pairing, auto-reconnect, session persistent)
- Dashboard admin: login, scan QR, lihat status, kelola API key & auto-reply, log pesan
- Command handler: `!menu`, `!ping`, `!info`, `!sticker`, `!toimg`, `!tiktok`, `!ig`, `!yt`, `!kick`, `!promote`, `!demote`
- Auto-reply rules (contains/exact/startsWith/regex)
- Worker yang polling `outgoing_messages` → kirim via Baileys → update status di DB

### Web / Vercel (`apps/web/`)

- Public REST API: `send-text`, `send-image`, `send-document`, `broadcast`, `messages/:id`, `health`, `status`
- API key auth + per-key rate limit (default 60/menit)
- Landing page + dokumentasi API (`/docs`)
- Stateless serverless functions

## Env vars

| App | Var | Required | Default | Note |
|-----|-----|----------|---------|------|
| both | `DATABASE_URL` | ✓ | — | Neon Postgres connection string |
| bot | `ADMIN_USERNAME` | ✓ | `admin` | login dashboard |
| bot | `ADMIN_PASSWORD` | ✓ | `changeme` | login dashboard |
| bot | `JWT_SECRET` | ✓ | — | random string panjang |
| bot | `PORT` | — | 3000 | port dashboard |
| bot | `BOT_NAME` | — | WinaBot | |
| bot | `BOT_PREFIX` | — | `!` | command prefix |
| bot | `WORKER_POLL_MS` | — | 1000 | interval polling DB (ms) |
| bot | `WORKER_BATCH` | — | 10 | jumlah pesan diproses per tick |
| bot | `SESSION_DIR` | — | `./auth_info_baileys` | folder session Baileys |

## Dokumentasi lengkap

- [`docs/API.md`](docs/API.md) — referensi REST API
- [`docs/DEPLOY-NEON.md`](docs/DEPLOY-NEON.md) — setup Postgres
- [`docs/DEPLOY-VERCEL.md`](docs/DEPLOY-VERCEL.md) — deploy gateway ke Vercel
- [`docs/DEPLOY-PTERODACTYL.md`](docs/DEPLOY-PTERODACTYL.md) — deploy bot ke Pterodactyl

## Disclaimer

Baileys adalah library WhatsApp **tidak resmi**. WhatsApp dapat memblokir nomor yang terindikasi spam. Gunakan dengan bijak (jangan kirim pesan massal tanpa izin recipient).

## License

MIT — © HabibiOfficial
