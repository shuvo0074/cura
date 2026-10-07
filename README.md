# Cura Health Platform

React 19 + Vite 8 frontend, Express 4 + PostgreSQL 16 backend.

## Developer Setup

### Prerequisites
- Docker + Docker Compose
- PostgreSQL (local or Docker)
- Git

### 1. Clone and configure

```bash
git clone git@github.com:Mohammed-Hassan-123/cura_app.git
cd cura_app
cp server/.env.example server/.env
```

Edit `server/.env`:
- Set `DATABASE_URL` to your local Postgres connection string
- MinIO is already pre-configured via Cloudflare tunnel — leave those values as-is

### 2. Restore the database

```bash
createdb cura_db
psql cura_db < server/db/dump.sql
```

### 3. Start the app

```bash
docker compose -f docker-compose.dev.yml up
```

Or without Docker (requires Node 22 + nvm):

```bash
npm install
npm install --prefix server
npm run dev
```

The app runs at http://localhost:5173

### Environment variables

| Variable | Dev default | Notes |
|---|---|---|
| `DATABASE_URL` | *(set in .env)* | Your local Postgres |
| `JWT_SECRET` | *(set in .env)* | Any random string for local |
| `MINIO_ENDPOINT` | `minio.updatedesm.xyz` | Cloudflare tunnel — shared dev MinIO |
| `MINIO_PORT` | `443` | |
| `MINIO_USE_SSL` | `true` | |
| `MINIO_ACCESS_KEY` | `cura_minio` | Ask team for secret key |
| `MINIO_BUCKET` | `cura-media` | |

## Production

Production runs on `cura-app` VM (192.168.100.30) via Docker Compose.

```bash
# Deploy (Jenkins runs this automatically on push to main)
./build.sh
```

Services:
- **web** — Vite preview on port 5173 (behind nginx TLS on 443)
- **api** — Express on port 4000
