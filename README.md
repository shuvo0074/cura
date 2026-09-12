# Cura Health Platform

A Practo-style doctor/hospital discovery and booking demo web app for Bangladesh. Patients
search doctors by specialty/symptom/location, view profiles, and book real appointment slots;
doctors log in to manage their bookings; admins manage the doctor/hospital directory.

This is a **demo/dummy build**: there is no real hospital network and no real SMS provider, but
authentication, booking, and admin CRUD are all functionally real against a live Postgres
database. All 500 doctors and 50 hospitals in the seed data are **fictional** (Dhaka-weighted,
realistic Bangladeshi names/addresses) — deliberately not scraped from real doctors, since the
booking flow is open to the public with no login gate.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite, React Router v7, Tailwind CSS v3, react-i18next, lucide-react |
| Backend | Express 4 + `pg` (raw SQL, no ORM), JWT auth (httpOnly cookie), bcryptjs |
| Database | PostgreSQL |

The frontend (`src/`) and backend (`server/`) are two separate npm projects — `server/` has its
own `package.json` and its own `node_modules`, installed independently of the root.

## Prerequisites

- Node.js **v22.x** (developed against v22.23.2)
- PostgreSQL **14+** (developed against 16.x), running locally or reachable over the network
- npm

## Setup

```bash
git clone <this-repo-url>
cd cura-app

# install frontend deps
npm install

# install backend deps (separate package.json)
cd server
npm install
```

### Configure environment

```bash
# still inside server/
cp .env.example .env
```

Edit `server/.env`:

```bash
PORT=4000
DATABASE_URL=postgresql://cura_app:CHANGE_ME@localhost:5432/cura
JWT_SECRET=change-this-to-a-long-random-string
SEED_ADMIN_PASSWORD=ChangeMe123!
# optional, defaults to DoctorPass123! if unset:
# SEED_DOCTOR_PASSWORD=DoctorPass123!
```

Create the database and role referenced by `DATABASE_URL` (adjust names/password to match what
you put above):

```bash
sudo -u postgres psql -c "CREATE ROLE cura_app WITH LOGIN PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -c "CREATE DATABASE cura OWNER cura_app;"
```

### Run migrations and seed data

`db:migrate` runs a plain `psql` command and does **not** load `.env` itself — export
`DATABASE_URL` into the shell first (the app code itself loads `.env` fine via `dotenv`, this
one script just doesn't):

```bash
# from the project root
export $(grep -v '^#' server/.env | xargs)
npm run db:migrate
```

This applies `server/db/schema.sql`, which is idempotent (`CREATE TABLE IF NOT EXISTS` /
`ADD COLUMN IF NOT EXISTS`) — safe to re-run any time.

```bash
npm run db:seed
```

Seeds ~500 doctors / 50 hospitals from `src/data/doctors.json` and `hospitals.json`. **This is
a no-op if the `hospitals` table already has any rows** — the whole seed run is skipped
entirely, so re-running it is always safe but won't refresh existing data.

## Running in development

From the project root, this starts both the API and the Vite dev server together (via
`concurrently`):

```bash
npm run dev
```

- API on `http://localhost:4000`
- Web (Vite, HMR) on `http://localhost:5173`

`vite.config.js` proxies `/api` requests from the frontend dev server to the backend, so just
open `http://localhost:5173`.

To run them separately instead (two terminals):

```bash
# terminal 1
cd server && npm run dev      # node --watch index.js

# terminal 2 (project root)
npm run dev -- --host         # or just: npx vite
```

## Login credentials (seeded)

| Role | Identifier | Password |
|---|---|---|
| Admin | `admin@cura.health` | value of `SEED_ADMIN_PASSWORD` (default `ChangeMe123!`) |
| Doctor | `firstname.lastname@cura.health` (e.g. `arif.khan@cura.health`), or `firstname.lastname.<id>@cura.health` for the 494 bulk-generated doctors | value of `SEED_DOCTOR_PASSWORD` (default `DoctorPass123!`) |
| Patient | any phone number | OTP is mocked — no real SMS is sent; the code is returned directly in the API response and shown on-screen |

## Other scripts

```bash
npm run build     # vite build -> dist/ (smoke-tested; the app is not currently deployed from dist/ anywhere)
npm run lint       # oxlint
npm run preview    # vite preview, serves the dist/ build
```

## Production-style deployment (systemd)

The reference deployment (an LXC container) does not use `npm run dev`. It runs two separate
systemd services so the API and the Vite dev server restart independently and survive reboots:

- `cura-api.service` — `node --watch index.js` in `server/`, binds `0.0.0.0:4000`
- `cura-web.service` — the local Vite dev binary directly
  (`node_modules/.bin/vite --clearScreen=false`), **not** `npm run dev` at the root (that would
  spawn `concurrently` and a second, conflicting API process)

Both units pin `PATH` to the Node install directory (needed when Node is installed via nvm,
since nvm isn't on systemd's default `PATH`), and both restart on failure. Example unit files:

```ini
# /etc/systemd/system/cura-api.service
[Unit]
Description=Cura Health Platform - API (Express + PostgreSQL)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/cura-app/server
ExecStart=/path/to/node/bin/node --watch index.js
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=development
Environment=PATH=/path/to/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/cura-web.service
[Unit]
Description=Cura Health Platform - Web (Vite dev server, HMR)
After=network.target cura-api.service
Wants=cura-api.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/cura-app
ExecStart=/path/to/cura-app/node_modules/.bin/vite --clearScreen=false
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=development
Environment=PATH=/path/to/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cura-api cura-web

# check / restart / logs
sudo systemctl status cura-api cura-web
sudo systemctl restart cura-api cura-web
sudo journalctl -u cura-web.service -n 50 --no-pager
```

**Known quirk to remember**: the Vite dev server occasionally fails to pick up a brand-new
Tailwind utility class (e.g. an arbitrary value like `min-h-[440px]`, or newer utilities like
`line-clamp-3`) via HMR, even though the file reloads without error — the class silently isn't
in the compiled stylesheet. Fix: a full restart of the web service/dev server, not just waiting
on HMR.

If ports are stuck from an earlier manual `npm run dev` run:

```bash
fuser -k 4000/tcp; fuser -k 5173/tcp
```

## Known limitations

- No automated tests.
- No pagination anywhere (now a real gap at 500 doctors / 50 hospitals in the admin dashboard).
- No real SMS provider — OTP is mocked and shown on-screen.
- No password-reset flow for doctor/admin accounts.
- Not deployed from a production build — always served via Vite dev mode + `node --watch`.
- Booking is open to any visitor with no auth gate; a demo disclaimer is shown on the booking
  card instead of an access restriction.
