# Deploy: Vercel (REST API gateway)

## 1. Connect repo

1. Login https://vercel.com (pakai akun GitHub yang punya akses ke `HabibiOfficial/whatsapp-bot-api`).
2. Klik **Add New → Project** → pilih repo **`whatsapp-bot-api`**.
3. **Root Directory:** klik **Edit** → pilih `apps/web`. **Penting** — kalau lupa, build akan crash.
4. **Framework Preset:** `Other` (atau `Vercel CLI`).
5. **Build & Output Settings:** biarkan default (Vercel akan auto-detect dari `vercel.json`).

## 2. Set environment variable

Di tab **Environment Variables**, tambah:

| Name | Value |
|------|-------|
| `DATABASE_URL` | `postgresql://...neon...url...` (dari Neon) |

Pilih scope: **Production**, **Preview**, dan **Development** (centang semua).

## 3. Deploy

Klik **Deploy** → tunggu ~30 detik. Kalau sukses, kamu akan dapat URL seperti `https://whatsapp-bot-api-xxxxx.vercel.app`.

## 4. Test

```bash
curl https://whatsapp-bot-api-xxxxx.vercel.app/api/health
# {"ok": true, "service": "whatsapp-bot-api-web", "ts": ...}

curl https://whatsapp-bot-api-xxxxx.vercel.app/api/status
# {"bot": "disconnected", "connected": false, ...}
```

Buka https://whatsapp-bot-api-xxxxx.vercel.app di browser → harus muncul landing page.

## 5. Custom domain (opsional)

1. Di Vercel project → **Settings** → **Domains**.
2. Tambah domain (mis. `api.namamu.com`) → ikuti instruksi DNS (CNAME ke `cname.vercel-dns.com`).
3. SSL otomatis (Let's Encrypt).

## Troubleshooting

- **Build error "@whatsapp-bot-api/db not found"** — pastikan Root Directory di-set ke `apps/web` dan **bukan** root repo.
- **`Could not connect to the database`** — cek `DATABASE_URL` udah benar (pakai pooled URL Neon, bukan direct).
- **Function timeout (10s)** — kalau bot lemot proses, response 202 akan dikembalikan. Klien bisa polling `/api/messages/:id` untuk cek status delivery.
- **Cold start** — first request bisa lambat (1-2 detik). Kalau pakai Vercel Hobby, ini normal.

## Hobby plan limits

- 100 GB-hours per bulan compute
- 100 deployments per hari
- 10 detik max function duration (cukup untuk bot kita karena sebagian besar request <2 detik)
- 1 concurrent build
