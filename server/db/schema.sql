-- Cura Health Platform schema. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS hospitals (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  location      TEXT NOT NULL,
  address       TEXT,
  hotline       TEXT,
  photo         TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  website       TEXT,
  doctor_count  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS doctors (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  specialty     TEXT NOT NULL,
  department    TEXT,
  experience    TEXT,
  chamber       TEXT,
  fees          INTEGER,
  city          TEXT,
  hospital_id   INTEGER REFERENCES hospitals(id),
  phone         TEXT,
  photo         TEXT,
  rating        NUMERIC(2,1),
  about         TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  website       TEXT,
  email         TEXT UNIQUE,
  password_hash TEXT,
  share_count   INTEGER NOT NULL DEFAULT 0,
  bmdc_no             TEXT,
  education           TEXT,
  languages           TEXT,
  consulting_hours    TEXT,
  address             TEXT,
  clinical_expertise  TEXT[],
  treatments          TEXT[],
  weekly_schedule     JSONB
);

-- Idempotent column adds for databases created before these columns existed.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS bmdc_no TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS languages TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS consulting_hours TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS clinical_expertise TEXT[];
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS treatments TEXT[];
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS weekly_schedule JSONB;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS division TEXT;
-- What a hospital offers beyond doctors' chambers.
--   type             'hospital' | 'diagnostic' | 'clinic' | 'online'
--   services         [{ key, hours }]   key from the app's service catalogue
--   beds             { general, cabin, icu } (counts; null for outpatient-only)
--   tests            [{ name, category, price }]   indicative prices in BDT
--   facilities       [key]   e.g. 'parking', 'wheelchair', 'prayer_room'
--   payment_methods  [key]   e.g. 'cash', 'bkash', 'card'
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS services JSONB;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS beds JSONB;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS tests JSONB;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS facilities JSONB;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS payment_methods JSONB;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS opening_hours TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS visiting_hours TEXT;
-- Where a real centre's details come from, and when they were last checked.
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS verified_on DATE;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS division TEXT;

CREATE TABLE IF NOT EXISTS patients (
  id            SERIAL PRIMARY KEY,
  phone         TEXT UNIQUE NOT NULL,
  name          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT
);

-- DEV ONLY mock OTP: code is stored/returned in plain text because this build
-- has no real SMS provider. Never do this for a real OTP secret.
CREATE TABLE IF NOT EXISTS otp_codes (
  id            SERIAL PRIMARY KEY,
  phone         TEXT NOT NULL,
  code          TEXT NOT NULL,
  purpose       TEXT NOT NULL DEFAULT 'login',
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctor_availability (
  id            SERIAL PRIMARY KEY,
  doctor_id     INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  slot_minutes  SMALLINT NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS appointments (
  id                SERIAL PRIMARY KEY,
  patient_id        INTEGER REFERENCES patients(id) NOT NULL,
  doctor_id         INTEGER REFERENCES doctors(id) NOT NULL,
  appointment_date  DATE NOT NULL,
  appointment_time  TIME NOT NULL,
  status            TEXT NOT NULL DEFAULT 'confirmed',
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Fire-and-forget log of "tapped to call this chamber" intent from the Call
-- popover — records the click, not confirmation that a call was placed or
-- connected (the web platform has no API to observe what happens after
-- window.open('tel:...') hands off to the OS dialer).
CREATE TABLE IF NOT EXISTS call_logs (
  id            SERIAL PRIMARY KEY,
  doctor_id     INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
  venue         TEXT,
  phone         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Chamber-serial booking: an appointment is a serial number in one chamber
-- session (a weekly_schedule entry: venue + time range) on a given date.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS session_time TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS serial_no INTEGER;
-- The old one-patient-per-time-slot rule doesn't fit serials (every serial
-- in a session shares the session's start time).
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_doctor_id_appointment_date_appointment_time_key;
-- Serials are never reused within a session, even after a cancellation.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_session_serial
  ON appointments (doctor_id, appointment_date, venue, session_time, serial_no)
  WHERE serial_no IS NOT NULL;
-- One active serial per patient per session.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_active_per_patient_session
  ON appointments (patient_id, doctor_id, appointment_date, venue, session_time)
  WHERE status <> 'cancelled' AND serial_no IS NOT NULL;

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS workplace TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS followup_fees INTEGER CHECK (followup_fees >= 0);

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS verified_on DATE;

-- Default preview follow-up fee; preserve previously entered amounts.
ALTER TABLE doctors ALTER COLUMN followup_fees SET DEFAULT 300;
UPDATE doctors SET followup_fees = 300 WHERE followup_fees IS NULL;

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gender_is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- Admins can hide a doctor or hospital: it leaves the public site but keeps
-- its bookings and history, and can be shown again.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Ambulance vendors, edited in the admin panel. Seeded once from
-- server/data/ambulanceVendors.json (see db/contentSeeds.js). `fares` holds
-- a vendor's own quoted ranges per category ({"ac": {"min": 2000, "max": 3500}});
-- categories without one show the shared sample range instead.
CREATE TABLE IF NOT EXISTS ambulance_vendors (
  id                SERIAL PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  name_bn           TEXT,
  base_area         TEXT,
  address           TEXT,
  address_bn        TEXT,
  phones            JSONB NOT NULL DEFAULT '[]',
  categories        JSONB NOT NULL DEFAULT '[]',
  features          JSONB NOT NULL DEFAULT '[]',
  dhaka_wide        BOOLEAN NOT NULL DEFAULT FALSE,
  service_areas     JSONB NOT NULL DEFAULT '[]',
  fares             JSONB NOT NULL DEFAULT '{}',
  source_url        TEXT,
  source_checked_on DATE,
  hidden            BOOLEAN NOT NULL DEFAULT FALSE
);

-- Site-wide content admins edit as one value: the shared sample ambulance
-- fares, the sample test price list and whether sample prices are shown.
-- Also records one-time imports, so they never run again.
CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Specialties and symptoms, edited in the admin panel; seeded once from
-- server/data (see db/contentSeeds.js). A specialty's `name` is what
-- doctors.specialty holds, so renaming one renames it on its doctors too.
-- `slug` is the page address and stays fixed.
CREATE TABLE IF NOT EXISTS specialties (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT UNIQUE NOT NULL,
  name_bn     TEXT,
  icon        TEXT,
  description TEXT,
  tags        JSONB NOT NULL DEFAULT '[]',
  image       TEXT,
  hidden      BOOLEAN NOT NULL DEFAULT FALSE
);

-- `specialties` lists the specialty names whose doctors treat the symptom;
-- the symptom page also matches doctors whose profile mentions it.
CREATE TABLE IF NOT EXISTS symptoms (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT UNIQUE NOT NULL,
  name_bn     TEXT,
  description TEXT,
  tags        JSONB NOT NULL DEFAULT '[]',
  image       TEXT,
  specialties JSONB NOT NULL DEFAULT '[]',
  hidden      BOOLEAN NOT NULL DEFAULT FALSE
);
-- Twelve fictional fixtures paired a male given name with "Begum", a surname
-- only women use. Rename them (name and bio); a no-op once applied.
UPDATE doctors d SET name = 'Dr. ' || r.new_name, about = replace(d.about, r.old_name, r.new_name)
FROM (VALUES
  ('Nazrul Begum', 'Nazrul Islam'), ('Musa Begum', 'Musa Ali'), ('Milton Begum', 'Milton Sarkar'),
  ('Nurul Begum', 'Nurul Haque'), ('Sabbir Begum', 'Sabbir Ahmed'), ('Masud Begum', 'Masud Rana'),
  ('Rafiqul Begum', 'Rafiqul Islam'), ('Ziaul Begum', 'Ziaul Haque'), ('Aminul Begum', 'Aminul Islam'),
  ('Mahmudul Begum', 'Mahmudul Hasan'), ('Shahidul Begum', 'Shahidul Talukder'), ('Rezwan Begum', 'Rezwan Ahmed')
) AS r(old_name, new_name)
WHERE d.name = 'Dr. ' || r.old_name AND d.source_url IS NULL;

-- ── Accounts ────────────────────────────────────────────────────────────
-- One account per person. What they can do comes from user_roles; their
-- role-specific details stay in profile tables (patients, doctors) that
-- point back here. Email is the MVP login; phone is for OTP login later.
CREATE TABLE IF NOT EXISTS users (
  id                SERIAL PRIMARY KEY,
  email             TEXT UNIQUE CHECK (email = lower(email)),
  phone             TEXT UNIQUE,
  password_hash     TEXT,
  name              TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  email_verified_at TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- staff, ambulance_owner and ambulance_driver are reserved for the invite
-- flows that come next; nothing grants them yet.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'staff', 'ambulance_owner', 'ambulance_driver', 'admin')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- A session is valid only while its row is unrevoked and unexpired, so
-- logout, disabling an account and "log out everywhere" take effect at once.
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client      TEXT NOT NULL DEFAULT 'web',
  user_agent  TEXT,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id) WHERE revoked_at IS NULL;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id INTEGER UNIQUE REFERENCES users(id);
ALTER TABLE patients ALTER COLUMN phone DROP NOT NULL;
-- The account that manages this listing. Set only by an admin: creating
-- the doctor, or approving a claim / registration.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS user_id INTEGER UNIQUE REFERENCES users(id);
-- When an admin checked this doctor's BMDC registration. Drives the public
-- "BMDC verified" badge; distinct from verified_on (when listing data was
-- last checked against its source).
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS bmdc_verified_at TIMESTAMPTZ;

-- A doctor's request to be verified: either claiming an existing listing
-- (doctor_id set) or a new doctor (details holds what they entered; the
-- listing is created on approval, so unreviewed doctors never go public).
CREATE TABLE IF NOT EXISTS doctor_verifications (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id    INTEGER REFERENCES doctors(id),
  kind         TEXT NOT NULL CHECK (kind IN ('claim', 'new')),
  bmdc_no      TEXT NOT NULL,
  details      JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note  TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  INTEGER REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS doctor_verifications_one_pending
  ON doctor_verifications (user_id) WHERE status = 'pending';

-- Move logins from the old per-role tables into users. Idempotent: rows
-- already linked are skipped. Admin-created doctor logins are linked to
-- their listing but not marked BMDC verified.
INSERT INTO users (email, password_hash, name)
  SELECT lower(email), password_hash, name FROM admins
  ON CONFLICT (email) DO NOTHING;
INSERT INTO user_roles (user_id, role)
  SELECT u.id, 'admin' FROM admins a JOIN users u ON u.email = lower(a.email)
  ON CONFLICT DO NOTHING;

INSERT INTO users (email, password_hash, name)
  SELECT lower(email), password_hash, name FROM doctors
  WHERE user_id IS NULL AND email IS NOT NULL AND password_hash IS NOT NULL
  ON CONFLICT (email) DO NOTHING;
UPDATE doctors d SET user_id = u.id FROM users u
  WHERE d.user_id IS NULL AND d.password_hash IS NOT NULL AND u.email = lower(d.email)
    AND NOT EXISTS (SELECT 1 FROM doctors o WHERE o.user_id = u.id);
INSERT INTO user_roles (user_id, role)
  SELECT user_id, 'doctor' FROM doctors WHERE user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

INSERT INTO users (phone, name)
  SELECT phone, name FROM patients WHERE user_id IS NULL AND phone IS NOT NULL
  ON CONFLICT (phone) DO NOTHING;
UPDATE patients p SET user_id = u.id FROM users u
  WHERE p.user_id IS NULL AND u.phone = p.phone;
INSERT INTO user_roles (user_id, role)
  SELECT user_id, 'patient' FROM patients WHERE user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

-- OTP attempts, so a code can't be guessed by brute force.
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts SMALLINT NOT NULL DEFAULT 0;

-- ── Doctor professional profile ─────────────────────────────────────────
-- What a doctor maintains about themselves once verified. Name, specialty
-- and BMDC number stay admin-controlled: they're what verification vouched for.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS headline TEXT;
-- Public profile URL: /dr/<slug>.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$');
-- Year they started practising; experience is shown as years since then.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practicing_since SMALLINT CHECK (practicing_since BETWEEN 1950 AND 2100);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ;

-- Career, education and recognition, one row per entry.
--   position       title @ organization, start–end (or current)
--   qualification  degree (title) from institution (organization), year (end_year)
--   publication    title, journal (organization), year, url
--   membership     role (title) in society (organization), since start_year
--   award          title from organization, year
CREATE TABLE IF NOT EXISTS doctor_profile_items (
  id           SERIAL PRIMARY KEY,
  doctor_id    INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('position', 'qualification', 'publication', 'membership', 'award')),
  title        TEXT NOT NULL,
  organization TEXT,
  location     TEXT,
  start_year   SMALLINT CHECK (start_year BETWEEN 1950 AND 2100),
  end_year     SMALLINT CHECK (end_year BETWEEN 1950 AND 2100),
  is_current   BOOLEAN NOT NULL DEFAULT FALSE,
  url          TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year)
);
CREATE INDEX IF NOT EXISTS doctor_profile_items_doctor ON doctor_profile_items (doctor_id, kind);

-- A verified doctor vouching for a colleague's area of expertise.
CREATE TABLE IF NOT EXISTS doctor_endorsements (
  doctor_id          INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  endorser_doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  skill              TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (doctor_id, endorser_doctor_id, skill),
  CHECK (doctor_id <> endorser_doctor_id)
);

-- Patient reviews, one per completed appointment, so every review comes
-- from a real visit.
CREATE TABLE IF NOT EXISTS doctor_reviews (
  id             SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id      INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id     INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT CHECK (length(comment) <= 1000),
  hidden_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS doctor_reviews_doctor ON doctor_reviews (doctor_id) WHERE hidden_at IS NULL;

-- Per-doctor daily reach: profile views and shares, counted on Bangladesh
-- days. Calls come from call_logs. Feeds the doctor's own insights panel.
CREATE TABLE IF NOT EXISTS doctor_daily_stats (
  doctor_id  INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  views      INTEGER NOT NULL DEFAULT 0,
  shares     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (doctor_id, day)
);
CREATE INDEX IF NOT EXISTS call_logs_doctor_created_idx ON call_logs (doctor_id, created_at);
