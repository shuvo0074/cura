# Cura — Doctor Practice Management Platform
## Development Budget & Costing Plan (BDT)

**Source document:** Cura draft 5.pdf (155 pages)
**Scope:** Web application (React) + Mobile application (React Native, iOS & Android) + shared backend
**Prepared:** August 2026

> **Basis of this estimate:** covers **hands-on development only** — backend, web frontend and React Native — plus domain, store accounts and hosting. Design, QA/testing, DevOps/infrastructure, project management and contingency are **not** included at the client's instruction. See Section 10.

---

## 1. Executive Summary

| Item | Hours | Cost (৳) |
|---|---:|---:|
| Backend, Dashboard & APIs | 1,134 | 1,70,100 |
| Web Application (React) | 619 | 1,54,800 |
| Mobile Application (React Native) | 714 | 1,78,500 |
| Domain & SSL (5.1) — ≈ $27 | — | 3,300 |
| App Store + Play Store accounts (5.2) — ≈ $125 | — | 15,300 |
| Cloud hosting, Launch tier (5.3) — ≈ $250/yr | — | 30,500 |
| **Total** | **2,467** | **৳5,52,500** |

*USD converted at ৳122/USD. Apple, Google and most cloud providers bill in USD — those three lines require an international card (see Section 5.2).*

*Excludes Section 5.4 other third-party services (৳2,51,000 — SMS gateway & volume, transactional email, payment gateway setup, error monitoring, backups, Facebook Login review, pre-launch security audit). Year-one all-in including those: **৳8,03,500**.*

---

## 2. Backend, Dashboard & APIs
*(Shared by both web and mobile; single source of truth.)*

| # | Module | Spec ref | Hours | Cost (৳) |
|---|---|---|---:|---:|
| 1 | Project setup, repo scaffolding, coding standards | — | 36 | 5,400 |
| 2 | Auth: register, login, OTP/MFA, JWT + refresh, remember-me 30 days, forgot password, Facebook/social login | 1.3.1, 1.3.2 | 72 | 10,800 |
| 3 | 4-step onboarding wizard APIs, draft auto-save, document upload | 3.2.6 | 48 | 7,200 |
| 4 | Practice/chamber profiles, weekly practice timings, **slot generation engine** | Practice Details | 60 | 9,000 |
| 5 | Staff & assistant management, RBAC roles, instant kill-switch / force logout | Practice Staff | 54 | 8,100 |
| 6 | Patient CRUD, Cura ID generation, duplicate detection, family/shared-number linking | Patient Intake | 54 | 8,100 |
| 7 | Universal search — multi-parameter (phone/name/ID/email), indexing, live results | 2.1.1 | 36 | 5,400 |
| 8 | Appointment engine — booking, walk-in, reschedule/drag-drop, cancel, no-show, token/serial, off-day & block calendar | Sec. 2.3, Walk-in | 78 | 11,700 |
| 9 | Queue/status engine + WebSocket real-time counters (Waiting/Engaged/Done/Cancelled) | Status Summary | 48 | 7,200 |
| 10 | Clinical records — vitals, clinical notes (4-part), prescriptions, diagnostic orders | Patient Dashboard | 84 | 12,600 |
| 11 | File & multimedia storage, categorisation, indexing, secure URLs | IV. File Module | 36 | 5,400 |
| 12 | Catalogs — drug, clinical note (5 categories), pricing, charting templates | Settings | 66 | 9,900 |
| 13 | **Privacy-first layer** — 90-day window, patient consent unlock, full audit trail | Data Privacy | 48 | 7,200 |
| 14 | Notification centre, push tokens, per-user preferences, mute defaults | Notification Centre | 42 | 6,300 |
| 15 | SMS + Email gateway integration, templates, dynamic placeholders, delivery reports | Communications | 60 | 9,000 |
| 16 | Cron jobs — 6-month follow-up, birthday/anniversary wishes, appointment reminders | Communications | 30 | 4,500 |
| 17 | Printout/PDF engine — templates, custom-pad scan & coordinate mapping, header/footer bypass | Printouts | 66 | 9,900 |
| 18 | Reports & statistics — income, invoiced, per-doctor/procedure/group aggregations | Reports | 54 | 8,100 |
| 19 | Feedback, community feed, support desk (urgent / live chat / scheduled call) | Support & Guidance | 66 | 9,900 |
| 20 | Subscription/premium tiers + payment gateway integration | Premium | 54 | 8,100 |
| 21 | Internal admin/support back-office (minimum viable) | Support | 42 | 6,300 |
| | **Subtotal** | | **1,134** | **৳1,70,100** |

---

## 3. Web Application (React)

| # | Module | Hours | Cost (৳) |
|---|---|---:|---:|
| 1 | Setup, component library, routing, state mgmt, EN–BN i18n | 43 | 10,800 |
| 2 | Welcome page (split-screen), login, register, OTP, forgot password | 25 | 6,300 |
| 3 | 4-step account creation wizard, stepper, validation gates, auto-save | 36 | 9,000 |
| 4 | Dashboard shell — header, collapsible sidebar (12 modules), sticky layout | 40 | 9,900 |
| 5 | **Calendar** — 4-pane layout, Day/3-Day/Week/Month grids, infinite vertical scroll, drag-and-drop reschedule, real-time line, mini block calendar, team directory | 72 | 18,000 |
| 6 | Appointment modals — Add appointment, Reminder, Block Calendar, Edit, Walk-in fast-track | 40 | 9,900 |
| 7 | Right contextual pane — patient snapshot, check-in / engage / no-show, live AJAX status | 22 | 5,400 |
| 8 | Universal search + as-you-type dropdown with profile preview | 14 | 3,600 |
| 9 | Notification centre, profile dropdown quick-toggles, help/support desk UI | 25 | 6,300 |
| 10 | Patient module — list, filters (Today/Recent/All), search, privacy gates & consent prompt | 32 | 8,100 |
| 11 | **Patient Dashboard SPA** — 4-box architecture, clinical timeline, zero-redirect inline forms (vitals, clinical notes with symptom sync, prescription smart grid, files/camera) | 79 | 19,800 |
| 12 | Settings module — 13 sub-screens (practice details, staff, calendar, communications, pricing, consent, security, catalogs, charting, printouts, emails, premium) | 94 | 23,400 |
| 13 | Reports & statistics with charts, filters, export/print | 29 | 7,200 |
| 14 | Communication reports, feedback management, community, profile management | 32 | 8,100 |
| 15 | Printout layout builder — template gallery, drag-drop component arrangement, live preview | 36 | 9,000 |
| | **Subtotal** | **619** | **৳1,54,800** |

---

## 4. Mobile Application (React Native)

Covers **iOS + Android from one codebase**. Assumes the doctor/assistant app mirrors core clinical and scheduling workflows; heavy configuration screens (printout builder, charting templates) remain web-only.

| # | Module | Hours | Cost (৳) |
|---|---|---:|---:|
| 1 | RN setup, navigation, shared UI components, offline cache, FCM/APNs push | 84 | 21,000 |
| 2 | Auth, OTP, onboarding wizard, native **camera document capture** (NID, certificates, signature) | 78 | 19,500 |
| 3 | Calendar — day/week/agenda views, appointment CRUD, walk-in fast-track, block calendar | 120 | 30,000 |
| 4 | Patient list, search, patient dashboard & clinical timeline | 108 | 27,000 |
| 5 | Clinical entry — vitals, clinical notes, prescription writing (mobile-optimised) | 108 | 27,000 |
| 6 | File upload / camera / digital signature capture | 42 | 10,500 |
| 7 | Notification centre + push handling + deep links | 36 | 9,000 |
| 8 | Settings — profile, practice timings, catalogs, communication toggles, staff access | 78 | 19,500 |
| 9 | Reports (lite) | 24 | 6,000 |
| 10 | Build config, code signing, store submission (App Store + Play), OTA update setup | 36 | 9,000 |
| | **Subtotal** | **714** | **৳1,78,500** |

---

## 5. Third-Party, Licence & Year-1 Running Costs
*(Not developer hours — paid directly by the client.)*

USD items converted at **৳122 / USD**. All figures below are **floor estimates** — the minimum realistic cost for each line. Usage-driven items (hosting, SMS volume, storage) rise with load.

### 5.1 Domain & SSL

| Item | Provider | One-time (৳) | Annual (৳) |
|---|---|---:|---:|
| Primary domain — `.com` | Namecheap / GoDaddy | — | 1,500 |
| Bangladesh domain — `.com.bd` *(optional but recommended for local trust)* | BTCL | 1,000 (registration) | 800 |
| SSL certificate — Let's Encrypt (auto-renew) | Free | — | 0 |
| **Subtotal** | | **1,000** | **2,300** |

**Year-1 total: ৳3,300.**

> Let's Encrypt is free, auto-renewing and trusted by all browsers and mobile OSes. A commercial wildcard certificate (৳8,000–15,000/yr) is only needed if an institutional policy demands an OV/EV certificate.

### 5.2 App Store & Play Store Accounts

| Item | Fee (USD) | One-time (৳) | Annual (৳) | Notes |
|---|---:|---:|---:|---|
| **Apple Developer Program** | $99/yr | — | 12,200 | Mandatory and **recurring** — apps are pulled from the App Store if it lapses. Organization accounts require a D-U-N-S number (free, 2–4 weeks to obtain). |
| **Google Play Developer account** | $25 once | 3,100 | — | One-time, lifetime. Organization accounts now require D-U-N-S + address verification. |
| **Subtotal** | | **3,100** | **12,200** | |

**Year-1 total: ৳15,300.**

> **Payment method warning:** Apple and Google bill in USD and accept international cards only. A Bangladeshi client will need a dual-currency / international debit or credit card with an endorsed travel quota, or a corporate USD card. This routinely delays first submission by 2–3 weeks — start account setup at the beginning of the mobile phase, not at the end. Apply for the D-U-N-S number in month 1.

### 5.3 Cloud Hosting

Pick a tier by expected load. Year-1 budget assumes the **Launch** tier.

| Tier | Target load | Infrastructure | Monthly | Annual (৳) |
|---|---|---|---:|---:|
| **Launch** | 0 – 20 doctors | 1× 2–4 GB VPS running app, PostgreSQL and Redis on the same instance; ~50 GB block storage; basic object storage; snapshot backups | ≈ $21 / ৳2,540 | **30,500** |
| **Growth** | 20 – 300 doctors | 2× 8 GB app servers + load balancer, managed PostgreSQL 8 GB with read replica, Redis 4 GB, dedicated WebSocket node, 500 GB storage + CDN | ≈ $205 / ৳25,000 | 3,00,000 |
| **Scale** | 300+ doctors | Auto-scaling group, HA multi-AZ database, WAF, dedicated backup infrastructure | ≈ $450 / ৳55,000 | 6,60,000 |

**Year-1 total (Launch tier, capped at $250/yr): ৳30,500.**

> **What $250/yr buys, and what it doesn't.** At roughly $21/month everything runs on a **single self-managed VPS** — application, database, Redis and WebSocket server on one box, with no managed services and no redundancy. That is workable for pilot usage, but note three consequences:
> - **No failover.** If the instance goes down, the clinic cannot book appointments or write prescriptions until it is restored. There is no standby.
> - **Self-managed database.** PostgreSQL tuning, upgrades, replication and backup verification become manual DevOps work — a discipline already excluded from this quote (Section 10).
> - **Document storage grows.** NID scans, medical certificates and prescription PDFs accumulate. 50 GB is consumed quickly at scale; storage overage is budgeted separately in Section 5.4.
>
> Expect to move to the Growth tier once real clinics are onboarded — plan for ৳3,00,000/yr from that point.

Suitable providers: **DigitalOcean, Vultr, Linode, Hetzner** (USD/EUR billing, international card needed — Hetzner is the cheapest at this tier) or **local BD providers** (BDIX, Dhaka Colo, ExonHost — BDT billing, no international card required, lower latency for local users, but weaker managed-database and object-storage tooling).

### 5.4 Other Services

| Item | One-time (৳) | Annual (৳) |
|---|---:|---:|
| Object storage & CDN beyond tier allowance (documents, NID scans, prescriptions) | — | 36,000 |
| SMS gateway — masking ID registration + BTRC/operator setup | 10,000 | — |
| SMS volume (est. 40,000 SMS/yr @ ৳0.30–0.45 masked) | — | 15,000 |
| Transactional email service (SES / SendGrid) | — | 12,000 |
| Payment gateway (SSLCommerz / bKash) setup | 5,000 | + 1.8–2.5% per transaction |
| Error monitoring & APM (Sentry or equivalent) | — | 24,000 |
| Live chat / support-desk tooling | — | 30,000 |
| Push notifications (Firebase Cloud Messaging) | Free | Free |
| Backup & disaster recovery storage | — | 24,000 |
| Facebook Login app review & compliance | 15,000 | — |
| Security audit / penetration test (recommended pre-launch) | 80,000 | — |
| **Subtotal** | **1,10,000** | **1,41,000** |

**Year-1 total: ৳2,51,000.**

### 5.5 Third-Party Cost Summary

| Group | Year 1 (৳) | Recurring / yr (৳) |
|---|---:|---:|
| 5.1 Domain & SSL | 3,300 | 2,300 |
| 5.2 App Store & Play Store accounts | 15,300 | 12,200 |
| 5.3 Cloud hosting (Launch tier) | 30,500 | 30,500 |
| 5.4 Other services | 2,51,000 | 1,41,000 |
| **Total** | **৳3,00,100** | **৳1,86,000** |

Recurring cost rises sharply once hosting moves from Launch to Growth tier (+৳2,69,500/yr). Budget a repeat security audit every 12–18 months.

---

## 6. Phased Delivery Option

The scope splits cleanly into three releases.

### Phase 1 — MVP: web-only, revenue-ready practice management

Auth & onboarding · dashboard shell · full calendar & appointments · walk-in · patient module · patient dashboard (vitals, clinical notes, prescriptions, files) · core settings (practice details, staff, calendar, drug catalog, clinical note catalog, communications, basic printout) · notification centre · SMS/email automation.

| | Hours | Cost (৳) |
|---|---:|---:|
| Backend 690 · Web 378 | **1,068** | **৳1,98,000** |

*Duration: ~2 months.*

### Phase 2 — React Native mobile app (iOS + Android)

| | Hours | Cost (৳) |
|---|---:|---:|
| Mobile 714 · Backend adjustments 60 | **774** | **৳1,87,500** |

*Duration: ~1.5 months (can partially overlap Phase 1).*

### Phase 3 — Advanced modules

Reports & statistics · printout layout builder & custom-pad mapping · subscription/premium & payments · consent forms · charting templates · community · feedback management · support desk · integrations.

| | Hours | Cost (৳) |
|---|---:|---:|
| Backend 384 · Web 241 | **625** | **৳1,17,900** |

*Duration: ~1 month.*

| Phase | Hours | Cost (৳) |
|---|---:|---:|
| Phase 1 — MVP (web) | 1,068 | 1,98,000 |
| Phase 2 — Mobile | 774 | 1,87,500 |
| Phase 3 — Advanced | 625 | 1,17,900 |
| **Total** | **2,467** | **৳5,03,400** |

---

## 7. Team Composition & Timeline

| Role | Count | Engagement |
|---|---:|---|
| Backend Developer | 2 | Full |
| Web Frontend Developer (React) | 2 | Full |
| React Native Developer | 2 | From month 2 |

At 6 full-time engineers × 160 hours/month ≈ **960 hours/month**.

**2,467 hours ÷ 960 ≈ 2.6 months of pure development effort → realistic calendar duration of 3.5–4.5 months**, allowing for client review cycles and app store approval waits.

Reducing to a 3-person team stretches the timeline to roughly 5–6 months at the same total cost.

---

## 8. Suggested Payment Milestones

Calculated on the development total of ৳5,03,400.

| Milestone | % | Amount (৳) |
|---|---:|---:|
| Contract signing / mobilisation | 15% | 75,510 |
| Backend architecture + auth & onboarding delivered | 15% | 75,510 |
| Phase 1 MVP delivered (calendar, patients, prescriptions) | 25% | 1,25,850 |
| Mobile apps submitted to stores | 20% | 1,00,680 |
| Phase 3 modules complete | 15% | 75,510 |
| Go-live + 30-day warranty closed | 10% | 50,340 |
| **Total** | **100%** | **৳5,03,400** |

---

## 9. Post-Launch Support (optional, annual)

| Option | Coverage | Annual cost (৳) |
|---|---|---:|
| Basic AMC | Bug fixes, security patches, dependency updates, 8×5 support | 75,500 |
| Standard AMC | Above + minor enhancements (~30 hrs/month), 12×6 support | 1,51,000 |
| Dedicated retainer | 2 developers on continuous roadmap | 4,02,700 |

Typical industry AMC is 15–20% of build cost per year.

---

## 10. Assumptions

1. **The client provides design, QA, DevOps and project management from its own resources.** These are real work that still has to happen; excluding them from this quote moves the cost and the responsibility to the client, not out of the project. Practical implications:
   - **Design** — developers need finished, screen-by-screen Figma files before build starts. Without them, the schedule in Section 7 does not hold.
   - **QA** — developers will unit-test their own work only. All functional, regression, cross-browser and cross-device testing sits with the client. For a clinical system handling prescriptions and patient records, this is the highest-risk exclusion in the document.
   - **DevOps** — the client provisions and maintains cloud infrastructure, CI/CD, monitoring and backups. Developers deploy to environments the client has already prepared.
   - **PM/BA** — the client owns sprint planning, requirement clarification, acceptance and stakeholder coordination, and must supply a decision-maker available on demand.
   - **No contingency** — any scope change, rework or requirement discovered mid-build is billed additionally on top of the figures above.
2. Hours reflect a lean, experienced team building to a fixed specification with no exploratory work. They assume finished designs, stable requirements, and no rework cycles.
3. One React Native codebase serves both iOS and Android; no separate native builds.
4. Backend is a single shared API for web and mobile — no duplicated business logic.
5. Web app is desktop-first responsive; it is **not** additionally optimised as a mobile web app (the RN app covers mobile).
6. Language support is English + Bangla for UI labels and SMS templates. Full Bangla content translation is client-supplied.
7. Patient-facing portal/app is **excluded** (see Section 11).
8. SMS, email, payment and hosting accounts are opened in the client's name; the client pays those providers directly.
9. Up to two rounds of revision per delivered module are included; beyond that is billed separately.
10. Client acceptance is completed within 10 working days per phase.

---

## 11. Explicitly Excluded from This Budget

Beyond the disciplines listed in Section 10, these appear in the source document but are either ambiguous, out of scope, or dependent on external parties:

| Item | Spec ref | Reason / note |
|---|---|---|
| **Patient-facing mobile app or portal** | implied by consent OTP, patient SMS | Not specified in the document. Estimate separately: ~540–720 hrs (৳1,35,000–৳1,80,000). |
| **Practo Integration** | Sidebar item 8 | Practo is an Indian platform with no public partner API for third parties. Requires a signed partnership before it can be scoped. Placeholder: 90–150 hrs if an API is granted. |
| **Prime Services** | Sidebar item 11 | No functional requirements written in the document. Needs definition. |
| **Community module** | Sidebar item 10, p.150–151 | Only a Practo screenshot is provided; no requirements. Budgeted here at minimum scaffolding only (read-only feed). A full social/Q&A platform would add 180–300 hrs. |
| **Consent Form module** | p.125–126 | Page contains only "Only for cura tab / Update to premium". Budgeted as basic template CRUD only. |
| **Sections marked "Not Complete"** | p.87–89 | Patient Module list/search and Data Privacy sections are flagged incomplete in the source. Estimated on stated content; material additions are billed separately. |
| **BMDC number live verification** | 1.3.2.1(b) | Assumes format validation only. Real-time verification against a BMDC registry API is not publicly available; manual admin verification is assumed. |
| **NID verification against NID server** | 3.2.6.4.1 | Assumes image upload + manual review. Election Commission NID API integration requires government approval and would add ~72 hrs plus per-query fees. |
| Telemedicine / video consultation | Pricing Catalog mentions "Consultation by Video Call" | Only the *fee* is in scope. Building the video calling feature would add ~150–210 hrs (৳37,500–৳52,500). |
| Data migration from an existing system | — | Not mentioned. Scope on request. |
| Hardware, printers, on-site clinic setup, staff training | — | — |

---

## 12. Cost Optimisation Levers

| Lever | Saving (৳) |
|---|---:|
| Web-responsive instead of a native RN app for v1 | 1,78,500 |
| Ship Phase 1 MVP only, self-fund Phases 2–3 from revenue | 3,05,400 deferred |
| Defer printout layout builder; ship 3 fixed templates instead | 11,700 |
| Drop Community + Prime Services from v1 | 10,800 |
| Use a third-party live-chat SaaS instead of building the support desk | 4,500 |
| Use local BD hosting instead of USD-billed cloud (no international card needed; saving is marginal at Launch tier, material at Growth) | ~60,000/yr at Growth tier |

---

*Estimates are based on the functional scope described in Cura draft 5.pdf and cover development only. Sections of the source document that are incomplete or contain only screenshots have been estimated on the basis of comparable modules; clarification of those areas may shift the totals.*
