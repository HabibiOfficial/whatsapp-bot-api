# REST API Reference

Sekarang ada **dua kelompok** endpoint:

| Layer | URL prefix | Auth | Tujuan |
|-------|-----------|------|--------|
| **Vercel** (`apps/web`) | `https://YOUR.vercel.app/api/...` | API key | Public REST API untuk kirim pesan WA |
| **Bot** (`apps/bot`) | `http://YOUR-PTERO-IP:3000/api/...` | admin login (cookie/JWT) | Dashboard admin (kelola key + auto-reply + lihat log) |

---

## Vercel (public REST API)

Auth: header `x-api-key: wba_xxxxxxxxxxxx` (atau `?apikey=wba_...` untuk debug).

### `GET /api/health`
Health check. Tanpa auth.

```json
{"ok": true, "service": "whatsapp-bot-api-web", "ts": 1730212345678}
```

### `GET /api/status`
Status koneksi bot (dibaca dari Postgres). Tanpa auth.

```json
{
  "bot": "connected",
  "connected": true,
  "user": {"jid": "62xxx@s.whatsapp.net", "name": "WinaBot"},
  "updated_at": "2026-04-29T02:00:00Z"
}
```

### `POST /api/messages/send-text`

```json
{ "to": "6281234567890", "message": "Halo!" }
```

- `200`: pesan terkirim → `{ ok, message_id, status: "sent", to }`
- `202`: queued, masih di-proses → `{ accepted, message_id, status: "pending" }`
- `400`: body invalid · `401`: api key invalid · `429`: rate limit · `502`: gagal kirim · `503`: bot disconnected

### `POST /api/messages/send-image`

```json
{ "to": "62xxx", "url": "https://...", "caption": "halo" }
```

### `POST /api/messages/send-document`

```json
{ "to": "62xxx", "url": "https://...", "filename": "x.pdf", "mimetype": "application/pdf" }
```

### `POST /api/messages/broadcast`

```json
{ "to": ["62111", "62222"], "message": "Halo semua!" }
```

Response `202`:
```json
{
  "accepted": true, "queued_count": 2, "skipped_count": 0,
  "queued": [{"to": "62111@s.whatsapp.net", "message_id": 100}, ...]
}
```

### `GET /api/messages/:id`
Cek status delivery (auth: api key yang sama dengan yang queue).

```json
{ "id": 42, "jid": "...", "type": "text", "status": "sent", "error": null, "created_at": "...", "processed_at": "..." }
```

---

## Bot dashboard (admin auth)

Endpoint ini **hanya dipakai dashboard internal**, bukan untuk client publik. Auth via cookie session yang di-set saat login.

### `POST /api/auth/login`
```json
{ "username": "admin", "password": "changeme" }
```
Set cookie `admin_token` (httpOnly, 7 hari).

### `POST /api/auth/logout`
Hapus cookie.

### `GET /api/auth/me`
Cek session aktif.

### API Keys
- `GET /api/keys` — list semua key
- `POST /api/keys` body `{ name, rateLimit? }` → response `{ id, name, key, ... }` (key cuma muncul sekali!)
- `PATCH /api/keys/:id/toggle` body `{ enabled }`
- `DELETE /api/keys/:id`

### Auto-Reply
- `GET /api/autoreplies`
- `POST /api/autoreplies` body `{ pattern, response, matchType: "contains"|"exact"|"startsWith"|"regex" }`
- `PATCH /api/autoreplies/:id/toggle`
- `DELETE /api/autoreplies/:id`

### Status & Logs
- `GET /api/status/public` — public, tanpa auth: `{ status, connected }`
- `GET /api/status` — full status + stats
- `GET /api/status/qr` — `{ qrDataUrl }`
- `POST /api/status/logout` — wipe Baileys session
- `GET /api/status/logs?limit=50` — riwayat pesan

---

## Status Codes

| Code | Arti |
|------|------|
| 200 | OK |
| 201 | Created |
| 202 | Accepted, async processing |
| 400 | Bad request |
| 401 | Unauthorized (no/invalid api key atau session) |
| 403 | Forbidden (key disabled) |
| 404 | Not found |
| 429 | Rate limit exceeded |
| 500 | Internal error |
| 502 | Bot gagal kirim |
| 503 | Bot disconnected |

## JID format

- Personal: `62812xxx@s.whatsapp.net` (atau cukup kirim `62812xxx`, di-normalize otomatis)
- Group: `1234567890-1234567890@g.us` (harus full JID)
