# REST API Reference

Semua endpoint mengirim/menerima JSON. API key dikirim via header `x-api-key` (preferred) atau query `?apikey=`.

Base URL: `http://localhost:3000` (atau domain kamu).

## Auth (admin dashboard)

### `POST /api/auth/login`

```json
{ "username": "admin", "password": "changeme" }
```

Response: `200` dengan cookie `admin_token` (httpOnly, 7 hari).

### `POST /api/auth/logout`

Hapus cookie session.

### `GET /api/auth/me`

Cek session aktif. `401` kalau belum login.

---

## API Keys (admin)

### `GET /api/keys`

```json
{
  "keys": [
    {
      "id": 1,
      "name": "Mobile App",
      "key": "wba_xxxxxxxx",
      "enabled": 1,
      "rate_limit": 60,
      "created_at": "2026-01-01 00:00:00",
      "last_used_at": "2026-01-01 00:00:00"
    }
  ]
}
```

### `POST /api/keys`

```json
{ "name": "Mobile App", "rateLimit": 60 }
```

Response berisi `key` baru — **simpan, hanya muncul sekali**.

### `PATCH /api/keys/:id/toggle`

```json
{ "enabled": true }
```

### `DELETE /api/keys/:id`

---

## Messages (butuh API key)

Header: `x-api-key: wba_...`

### `POST /api/messages/send-text`

```json
{ "to": "6281234567890", "message": "Halo!" }
```

### `POST /api/messages/send-image`

```json
{
  "to": "6281234567890",
  "url": "https://example.com/image.jpg",
  "caption": "Optional caption"
}
```

### `POST /api/messages/send-document`

```json
{
  "to": "6281234567890",
  "url": "https://example.com/file.pdf",
  "filename": "invoice.pdf",
  "mimetype": "application/pdf"
}
```

### `POST /api/messages/broadcast`

```json
{
  "recipients": ["6281111111111", "6282222222222"],
  "message": "Pengumuman!",
  "delayMs": 1500
}
```

Response:

```json
{
  "ok": true,
  "results": [
    { "to": "6281111111111@s.whatsapp.net", "ok": true },
    { "to": "6282222222222@s.whatsapp.net", "ok": false, "error": "..." }
  ]
}
```

### `GET /api/messages/check-number?number=6281234567890`

```json
{ "exists": true, "jid": "6281234567890@s.whatsapp.net" }
```

---

## Status

### `GET /api/health`

Public healthcheck. Selalu `200 { ok: true, ts: ... }`.

### `GET /api/status/public`

Public. `{ status, connected }`.

### `GET /api/status` (admin)

Lengkap dengan stats dan info user yang login.

### `GET /api/status/qr` (admin)

`{ status, qrDataUrl }` — data URL gambar QR, render dengan `<img src="...">`.

### `POST /api/status/logout` (admin)

Logout bot WhatsApp & hapus sesi (perlu scan QR ulang).

### `GET /api/status/logs?limit=50` (admin)

Log pesan terbaru.

---

## Auto-Reply (admin)

### `GET /api/autoreplies`

### `POST /api/autoreplies`

```json
{
  "pattern": "halo",
  "response": "Halo juga!",
  "matchType": "contains"
}
```

`matchType`: `contains` (default) | `exact` | `startsWith` | `regex`.

### `PATCH /api/autoreplies/:id/toggle` `{ enabled: true }`

### `DELETE /api/autoreplies/:id`

---

## Error format

```json
{ "error": "human-readable message" }
```

HTTP status:
- `400` — validasi gagal
- `401` — auth gagal (tidak ada / invalid API key / belum login)
- `429` — rate limit terlampaui
- `503` — bot belum connected (perlu scan QR)
- `500` — error internal
