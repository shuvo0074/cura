# Cura — Doctor Practice Management Platform
## Development Budget & Costing Plan (BDT)

**Source document:** Cura draft 5.pdf (155 pages)
**Scope:** Web application (React) + Mobile application (React Native, iOS & Android) + shared backend
**Prepared:** August 2026

> **Basis of this estimate:** covers **hands-on development only** — backend, web frontend and React Native — plus domain, store accounts and first-year hosting.
>
> **Not included:** UI/UX design, QA/testing, DevOps/infrastructure management, project management, and contingency for scope change. These remain the client's responsibility. Hours assume finished designs, stable requirements and no rework cycles.

---

## 1. Executive Summary

| Item | Hours | Cost (৳) |
|---|---:|---:|
| Backend, Dashboard & APIs | 1,134 | 1,70,100 |
| Web Application (React) | 619 | 1,54,800 |
| Mobile Application (React Native) | 714 | 1,78,500 |
| Domain & SSL — ≈ $27 | — | 3,300 |
| App Store + Play Store accounts — ≈ $125 | — | 15,300 |
| Cloud hosting, Launch tier — ≈ $250/yr | — | 30,500 |
| **Total** | **2,467** | **৳5,52,500** |

*USD converted at ৳122/USD. Apple ($99/yr, recurring), Google Play ($25 one-time) and most cloud providers bill in USD — those three lines require an international card or corporate USD card.*

*Excludes other third-party running costs of approximately ৳2,51,000 in year one — SMS gateway registration & volume, transactional email, payment gateway setup, error monitoring, backups, Facebook Login review and a pre-launch security audit. **Year-one all-in including those: ৳8,03,500.***

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

## 5. Explicitly Excluded from This Budget

Beyond the disciplines named in the basis note above (design, QA, DevOps, project management, contingency), the following appear in the source document but are either ambiguous, out of scope, or dependent on external parties:

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
| Telemedicine / video consultation | Pricing Catalog mentions "Consultation by Video Call" | Only the *fee* is in scope. Building the video calling feature would add ~150–210 hrs. |
| Data migration from an existing system | — | Not mentioned. Scope on request. |
| Hardware, printers, on-site clinic setup, staff training | — | — |

---

*Estimates are based on the functional scope described in Cura draft 5.pdf and cover development only. Sections of the source document that are incomplete or contain only screenshots have been estimated on the basis of comparable modules; clarification of those areas may shift the totals.*
