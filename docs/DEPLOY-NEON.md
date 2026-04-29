# Deploy: Setup Neon Postgres

Database digunakan bersama oleh `apps/web` (Vercel) dan `apps/bot` (Pterodactyl). Pakai **Neon** karena gratis (0.5GB) dan punya HTTP driver yang cocok untuk Vercel serverless.

## 1. Bikin akun & project

1. Buka https://console.neon.tech → daftar (login pakai GitHub/Google).
2. Klik **New Project**:
   - Project name: `whatsapp-bot-api`
   - Postgres version: `17` (default)
   - Region: pilih yang dekat (mis. `AWS Asia Pacific (Singapore)`)
3. Selesai → kamu langsung dapat halaman project.

## 2. Copy connection string

1. Di sidebar kiri, klik **Connection Details**.
2. Pastikan tab **Pooled connection** dipilih (penting untuk serverless).
3. Copy URL yang formatnya:
   ```
   postgresql://USER:PASS@ep-xxxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```
4. Simpan baik-baik — ini yang akan jadi env var `DATABASE_URL` di Vercel **dan** di bot.

## 3. Apply schema

Di komputer kamu (atau di session Devin):

```bash
git clone https://github.com/HabibiOfficial/whatsapp-bot-api
cd whatsapp-bot-api
DATABASE_URL='postgresql://...your...url...' node packages/db/migrate.js
```

Output:
```
applying schema to ep-xxxxx-pooler.REGION.aws.neon.tech
done
```

Atau pakai psql:

```bash
psql "postgresql://...your...url..." -f packages/db/schema.sql
```

## 4. Verifikasi

```bash
psql "$DATABASE_URL" -c "\dt"
```

Harus muncul: `api_keys`, `auto_replies`, `bot_state`, `message_logs`, `outgoing_messages`.

## Tips

- **Free tier** Neon punya autoscale to zero — DB akan "tidur" kalau idle, bangun lagi otomatis saat ada query (latency ~500ms first hit).
- Branching: kalau mau staging vs production, bikin branch baru di Neon — masing-masing punya URL berbeda.
- Backup: free tier punya 7-day point-in-time recovery.
