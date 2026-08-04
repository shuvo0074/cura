# Cura — Architecture

Monorepo containing the API, the web application and the mobile application for
the doctor practice-management platform described in `Cura draft 5.pdf`.

```
packages/shared/   Design tokens, config, contracts, validation, MVVM runtime
backend/           NestJS API — hexagonal architecture, Prisma, PostgreSQL
web/               React + Vite (Views only)
mobile/            React Native CLI (Views only)
```

## Why the shared package is large

Anything that both clients must agree on lives in `@cura/shared`, not in either
app:

| Concern | Location | Consequence |
|---|---|---|
| Colours, spacing, radii, status palette | `design/theme.ts` | One rebrand edit repaints web + mobile |
| Business rules (OTP length, slot minutes, privacy window) | `config/app-config.ts` | A rule cannot be right in one app and wrong in the other |
| Validation | `validation/schemas.ts` | The API and both clients enforce identical rules |
| Wire contracts | `domain/models.ts` | Compile error, not a runtime surprise, when the API changes |
| Status transition graph | `domain/enums.ts` | Clients cannot offer an illegal action |
| ViewModels + HTTP client | `runtime/` | Web and mobile share behaviour; only Views differ |

## SOLID mapping

- **Single responsibility** — `TokenService` mints sessions, `OtpService` owns
  second factors, `CryptoService` owns primitives, `AuthService` only sequences
  them. `AppointmentService` holds scheduling invariants; controllers translate
  HTTP and nothing else.
- **Open/closed** — authorisation is permission-based (`@RequirePermissions`),
  so adding or re-scoping a role edits `rolePermissions` and touches no
  controller.
- **Liskov** — every adapter is substitutable for its port; `Clock` is the clear
  case, where tests inject a fixed implementation.
- **Interface segregation** — ports are narrow (`Cache`, `SmsSender`,
  `FileStorage`, `EventBus`) rather than one service interface.
- **Dependency inversion** — services depend on symbols from `core/ports`;
  `infrastructure.module.ts` is the only file that names a concrete class.

## MVVM

```
View (React / React Native)  →  renders state, forwards events, no logic
ViewModel (plain TypeScript) →  state + behaviour, no framework import
Model (@cura/shared)         →  contracts, rules, validation
```

`LoginViewModel` and `CalendarViewModel` are imported unchanged by both apps.
`useViewModel` binds one to a component through `useSyncExternalStore`.

## Running it

```bash
npm install
npm run build:shared

# backend — needs PostgreSQL + Redis
cd backend
cp .env.example .env          # then fill in the generated secrets
npx prisma migrate dev
npm run start:dev

# web
npm run dev:web

# mobile
npm run dev:mobile
```

`backend/.env` refuses to load on a missing or malformed value, and production
additionally rejects console SMS/email drivers and an empty CORS allowlist.

## Status

**Backend — 56 routes, all exercised against a live database:**

- Auth: registration, login, OTP, refresh rotation with reuse detection,
  lockout, RBAC, account-enumeration resistance
- Appointments: booking, overlap prevention, status graph, queue counters
- Clinical: encounters, vitals, notes, prescriptions, sign-and-freeze,
  90-day privacy window with OTP-gated patient consent
- Onboarding: 4-step wizard, server-side draft autosave, validation gate,
  skip rules, one-time execution, AES-256-GCM NID encryption
- Settings: practice profile, weekly sessions with overlap rejection,
  closures, staff with instant kill-switch, drug catalog, 5-part clinical-note
  catalog, pricing, charting templates, communications matrix, printout page
  setup, consent forms, subscription
- Billing: invoices (catalog price authoritative), payments with
  over-payment rejection, status derivation
- Reports: income, appointment volume, top procedures, demographics —
  aggregated in SQL
- Realtime: authenticated WebSocket gateway pushing `queue.changed` into
  per-practice rooms

**Web:** login/OTP, calendar, onboarding wizard, patient dashboard
(timeline + prescription writer with drug auto-suggest and consent unlock).

**Mobile:** login/OTP and day agenda, sharing the same ViewModels.
Bare React Native CLI — native `ios/` and `android/` projects are checked in,
so native modules can be added without an eject step.

Not built: document upload endpoints (schema and storage port exist, the
multipart route does not), PDF rendering for printouts (settings are stored;
generation is not implemented), Practo integration, Prime Services, Community.
