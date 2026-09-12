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
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (doctor_id, appointment_date, appointment_time)
);
