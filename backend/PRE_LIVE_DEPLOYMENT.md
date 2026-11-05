# Backend Pre-Live Deployment

Follow this before the first real release on Render. The current Render server is a
demo: it has known passwords, demo records and `NODE_ENV` not set to `production`.

**Do not turn the demo server into the live one. Create a new production API and
database, and leave the demo as it is.**

Do the parts in order. Part 1 needs code changes, so it comes well before release day.

## Part 1: Finish these code changes

The backend cannot go live safely until the first five are done.

| # | Blocker | Why it blocks release | Where |
| --- | --- | --- | --- |
| 1 | Real SMS sender | `SMS_PROVIDER` accepts `ssl_wireless` and `twilio`, but only the console sender exists. Production refuses `console`, and naming a real provider still uses the console sender. Staff who need an OTP to log in never receive it. | `src/infrastructure/infrastructure.module.ts`, `src/infrastructure/adapters/system.adapters.ts` |
| 2 | Real email sender | Same problem: only `ConsoleEmailSender` exists. | Same files |
| 3 | First-clinic setup script | Only `prisma/seed.ts` creates a practice, and it also creates demo accounts with published passwords. A clean database has no way to get its first clinic or Administrator. | Add a script under `prisma/` that takes a clinic name and an admin's email and mobile, with no default password |
| 4 | Configurable upload folders | Both folders are fixed to the process folder (`storage`, `storage-public`). A Render disk has one mount path, so they need a setting such as `STORAGE_ROOT`, or an S3 adapter. Without this, uploads are lost on every deploy. | `src/infrastructure/adapters/file-storage.adapter.ts`, `src/infrastructure/adapters/public-media.adapter.ts`, `src/modules/printouts/printout.service.ts` |
| 5 | Password reset | The clinic login links to `/forgot-password`, but the backend has no reset route. Anyone who forgets a password is locked out for good. | `web/src/features/auth/LoginView.tsx`, new routes in `src/modules/auth` |

Fix or decide these before release as well:

| # | Item | Action |
| --- | --- | --- |
| 6 | Realtime queue updates | `web/index.html` limits `connect-src` to `'self'` and localhost, and a static-site rewrite may not carry WebSockets. Set `VITE_WS_BASE_URL`, allow that host in the policy, and confirm the queue board updates live. |
| 7 | Two failing browser tests | `calendar.spec.ts` (doctor filter) and `modules.spec.ts` (Communications) also fail on the code before the directory merge. Fix the tests or the behaviour. |
| 8 | Login limit | Login allows 10 attempts per 15 minutes per IP. A clinic whose staff share one IP can hit this at the start of a shift. Decide whether to raise it. |
| 9 | Review moderation | Reviews have a hidden state, but no admin route sets it, so a bad review cannot be removed without database access. |
| 10 | Friday closure | Online booking refuses every Friday for every doctor. Confirm that is the rule you want. |
| 11 | Expired login tokens | `deleteExpired` exists, but nothing calls it, so the table keeps growing. Add a scheduled cleanup. |
| 12 | Mobile API address | `mobile/src/config/env.ts` points release builds at `api.cura.health`. Make that match the real host before any mobile release. |

## Part 2: Check the code on your computer

Run these on the commit you plan to release, from the repo root.

```bash
npm ci
npm run build:shared
npm run typecheck

createdb -O cura --encoding=UTF8 --locale=C --template=template0 cura_merge_test
cd backend
DATABASE_URL=postgresql://cura:cura@localhost:5432/cura_merge_test npx prisma migrate deploy
TEST_DATABASE_URL=postgresql://cura:cura@localhost:5432/cura_merge_test npm test
npm run build
cd ..
dropdb cura_merge_test
```

Every command must pass. Then run the browser tests by following "End-to-end UI tests"
in the root `README.md`.

## Part 3: Create the production services

Create these on Render, separate from the demo services:

1. **PostgreSQL 16.** Turn on backups.
2. **Redis.** Use the same region as the API. Limits fall back to allowing all requests if Redis is down, so it needs to be reliable.
3. **API web service.** Run **one instance only**. Rate limits are shared through Redis, but realtime events and local uploads work on a single instance.
4. **Persistent disk on the API.** Mount it at the path you set in blocker 4. Skip this if you built S3 storage instead.

Check the database collation, because patient prefix search needs `C`:

```bash
psql "<production External Database URL>" -c "SHOW lc_collate;"
```

If it isn't `C`, test patient search carefully on this database before continuing.

Set these API commands in Render:

| Setting | Value |
| --- | --- |
| Build Command | `npm ci --include=dev && npm run build:shared && npx prisma generate --schema backend/prisma/schema.prisma && npm run build -w @cura/backend` |
| Pre-Deploy Command | `cd backend && npx prisma migrate deploy` (if your plan has none, run this by hand in Part 5) |
| Start Command | `cd backend && node dist/main.js` |

`--include=dev` matters: with `NODE_ENV=production`, a plain install skips the build tools and Prisma.

## Part 4: Set the environment

Generate new secrets. Never reuse the demo values.

```bash
openssl rand -base64 48    # JWT_ACCESS_SECRET
openssl rand -base64 48    # JWT_REFRESH_SECRET (must be different)
openssl rand -hex 32       # FIELD_ENCRYPTION_KEY
openssl rand -base64 24    # OTP_PEPPER
```

Store a copy of `FIELD_ENCRYPTION_KEY` somewhere safe outside Render. **If it is lost or
changed later, stored NID numbers can never be read again.**

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Production Internal Database URL |
| `REDIS_URL` | Production Redis URL |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | New values from above |
| `FIELD_ENCRYPTION_KEY`, `OTP_PEPPER` | New values from above |
| `CORS_ORIGINS` | Your real web origins, comma-separated. Production refuses to start if this is empty |
| `TRUST_PROXY` | The real proxy hop count. Start with `2` for a web rewrite plus Render's balancer, then confirm in Part 6 |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID` | Your real SMS account |
| `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM` | Your real email account |
| `DB_POOL_SIZE` | At or below what the database plan allows per API instance |
| `LOG_LEVEL` | `info` |
| `DIRECTORY_BOOKING_ENABLED` | `true`, or `false` for phone booking only |

Do not set `THROTTLE_DISABLED`. Add the upload folder setting from blocker 4 as well.

On the web service, set `VITE_ENVIRONMENT=production` and `VITE_API_BASE_URL=/api`, and
rewrite `/api/*` to the production API, ahead of the `/*` to `/index.html` fallback.

## Part 5: Prepare the production database

Run these from your computer, on the release commit.

```bash
cd backend
export DATABASE_URL="<production External Database URL>"
npx prisma migrate deploy
npm run seed:directory
```

Then run your first-clinic script from blocker 3.

**Never run `npm run seed` on this database.** It creates accounts whose passwords are
published in `README.md` and `CURA_GUIDE.md`.

Create the directory admin. Register a real account with a strong password, then:

```bash
npm run directory:grant-admin -- <that real email>
unset DATABASE_URL
cd ..
```

Do not copy anything from the demo database. These demo records stay behind with it:

- all `@cura.local` accounts
- Cura Demo Hospital
- Dr. Demo Physician, Dr. Demo Paediatrician, Dr. Demo Gynaecologist and Dr. Demo Doctor
- BMDC number A-999901, and the demo bookings and review

## Part 6: Deploy and verify

Deploy the API, then the web app. Set `API` and `WEB` first:

```bash
API=https://<production-api-host>/api
WEB=https://<production-web-host>
```

**The API is up and has its data.** The doctors count should be 7 and hospitals 9, unless you have added more:

```bash
curl -s $API/directory/health
curl -s $API/directory/doctors/stats
```

**Protected routes refuse anonymous callers.** Each should print `401`:

```bash
for p in auth/me patients directory/admin/doctors; do
  curl -s -o /dev/null -w '%{http_code}\n' $API/$p
done
```

**Demo accounts do not exist.** This should print `401`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/auth/login \
  -H 'content-type: application/json' \
  -d '{"identifier":"admin@cura.local","password":"CuraAdmin123"}'
```

**Production security is on.** Log in with a real account that has a verified mobile. The output must show `Secure` on the cookie and a `strict-transport-security` header:

```bash
curl -si -X POST $API/auth/login -H 'content-type: application/json' \
  -d '{"identifier":"<real email>","password":"<real password>"}' \
  | grep -iE '^(set-cookie|strict-transport-security)' \
  | sed -E 's/cura_rt=[^;]*/cura_rt=<hidden>/'
```

**The web proxy works.** This should print `{"ok":true}`:

```bash
curl -s $WEB/api/directory/health
```

Then check these by hand:

- [ ] A real phone receives an OTP, and the code does not appear in the Render logs.
- [ ] A real inbox receives email.
- [ ] Password reset works from start to finish.
- [ ] Clinic: log in, book an appointment, write and sign a prescription, create an invoice.
- [ ] The queue board updates live in a second browser window.
- [ ] A clinic Administrator gets 403 on `/api/directory/admin/doctors`.
- [ ] Upload a document and a doctor photo, **redeploy**, and confirm both are still there.
- [ ] Log out, then confirm the old access token gets 401.
- [ ] Repeated requests from two different networks are counted separately. If they share a limit, `TRUST_PROXY` is wrong.
- [ ] Set an uptime check on `/api/directory/doctors/stats`. It reads the database, while `/directory/health` does not.

## Part 7: If something goes wrong

1. In Render, roll the API and web services back to the previous deploy.
2. The directory migration only adds tables and one role value, so the older code keeps working with it. Do not undo a migration by hand.
3. Restore a database backup only if data itself is damaged. Anything written since that backup is lost.
4. **Never run `prisma migrate reset` or `prisma db push` on production.** The first deletes everything.
