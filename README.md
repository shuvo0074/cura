# Cura

Doctor practice-management platform — API, web app and mobile app in one monorepo.

```
packages/shared/   design tokens, config, contracts, validation, ViewModels
backend/           NestJS + Prisma + PostgreSQL
web/               React + Vite
mobile/            Expo React Native
```

## Prerequisites

**Node.js 20+**, plus **PostgreSQL 16** and **Redis**. Pick one way to get them —
the choice matters again in the Database step below.

**Docker** (fewest steps):

```bash
docker compose up -d
```

**Homebrew** (macOS, no Docker licence to consider):

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
```

## Install

```bash
git clone <repo> cura && cd cura
npm install
npm run build:shared        # the other packages import from its build output
```

## Configure

```bash
cd backend
cp .env.example .env
```

Fill in the four secrets — the API refuses to start on placeholder values:

```bash
# run each, paste into .env
openssl rand -base64 48    # JWT_ACCESS_SECRET
openssl rand -base64 48    # JWT_REFRESH_SECRET   (must differ from the above)
openssl rand -hex 32       # FIELD_ENCRYPTION_KEY (exactly 64 hex chars)
openssl rand -base64 24    # OTP_PEPPER
```

## Database

**If you used Docker** — nothing to create. The container already provisions the
`cura` role, database and `C` collation, which is what the default
`DATABASE_URL` expects. Just confirm both services are healthy:

```bash
docker compose ps           # postgres and redis should read "healthy"
```

**If you used Homebrew** — create the role and database yourself:

```bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
createuser -s cura
createdb -O cura --encoding=UTF8 --locale=C --template=template0 cura
```

Then either way, from `backend/`:

```bash
npx prisma migrate dev      # apply schema
npm run seed                # demo practice, doctor, patients, appointments
```

> The `C` locale is not cosmetic — the patient prefix-search index uses
> `text_pattern_ops`, which only works under a deterministic collation.

## Run

Two terminals, both from the **repo root**:

```bash
npm run dev:backend         # http://localhost:3000/api
npm run dev:web             # http://localhost:5173
```

Mobile (optional):

```bash
npm run dev:mobile          # Expo — press i for iOS, a for Android
```

## Sign in

The seed creates a verified account, so login skips OTP:

```
01711111111  /  CuraDoctor123
```

To exercise the OTP flow, register a new account in the UI — in development the
code is printed to the API console.

## Common commands

| Command | Where | Purpose |
|---|---|---|
| `npm run typecheck` | root | typecheck shared + backend + web |
| `npm run build:shared` | root | rebuild after editing `packages/shared` |
| `npx prisma migrate dev` | `backend/` | apply schema changes |
| `npm run seed` | `backend/` | reset demo data (idempotent) |
| `npx prisma studio` | `backend/` | browse the database |

## Troubleshooting

**`EADDRINUSE :3000`** — an API instance is already running:
`lsof -nP -iTCP:3000 -sTCP:LISTEN -t | xargs kill`

**Web build fails on a `@cura/shared` import** — run `npm run build:shared`; the
web app resolves the shared package from its build output, not its source.

**Redis fails to start on Homebrew 8.x** — the shipped `redis.conf` loads
modules the formula does not install. Comment out the `loadmodule` lines in
`/opt/homebrew/etc/redis.conf` and restart.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and what is / is not built.
