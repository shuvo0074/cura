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
