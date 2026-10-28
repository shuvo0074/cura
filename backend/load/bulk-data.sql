-- Realistic volume for load testing: one busy practice over ~2 years —
-- 20,000 patients, 150,000 appointments, ~16,000 signed visits.
--
-- Run against a THROWAWAY copy of a seeded database, never a real one:
--   createdb -O cura --encoding=UTF8 --locale=C --template=template0 cura_load
--   DATABASE_URL=postgresql://cura:cura@localhost:5432/cura_load npx prisma migrate deploy
--   DATABASE_URL=postgresql://cura:cura@localhost:5432/cura_load npm run seed
--   psql -d cura_load -f load/bulk-data.sql
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO patients (id, "practiceId", "curaId", "fullName", mobile, "searchName", gender, "dateOfBirth", "profileComplete", "lastVisitAt", "updatedAt")
SELECT gen_random_uuid(), '11111111-1111-4111-8111-111111111111',
       'CURA-' || (200000 + g),
       n.first || ' ' || n.last,
       '+88017' || lpad((10000000 + g)::text, 8, '0'),
       lower(n.first || ' ' || n.last),
       (CASE WHEN g % 2 = 0 THEN 'MALE' ELSE 'FEMALE' END)::"Gender",
       date '1950-01-01' + (g * 37 % 25000),
       g % 5 <> 0,
       now() - ((g % 700) || ' days')::interval,
       now()
FROM generate_series(1, 20000) g
CROSS JOIN LATERAL (
  SELECT (ARRAY['Rahim','Karim','Fatema','Ayesha','Hasan','Nusrat','Sabbir','Mitu','Jamal','Rumana','Tareq','Sadia'])[1 + g % 12] AS first,
         (ARRAY['Ahmed','Hossain','Rahman','Islam','Khan','Chowdhury','Akter','Uddin','Sarkar','Begum'])[1 + (g / 12) % 10] AS last
) n;

-- 150k appointments: Sun–Thu, 09:00–20:50 in 10-minute slots, ±1 year.
INSERT INTO appointments (id, "practiceId", "doctorId", "patientId", "scheduledAt", "endsAt", "durationMinutes", status, "visitType", "tokenNumber", "plannedProcedures", "updatedAt")
SELECT gen_random_uuid(), p."practiceId", d.id, p.id, s.at, s.at + interval '10 minutes', 10,
       (CASE WHEN s.at > now() THEN 'SCHEDULED' WHEN g % 11 = 0 THEN 'NO_SHOW' WHEN g % 17 = 0 THEN 'CANCELLED' ELSE 'DONE' END)::"AppointmentStatus",
       (ARRAY['NEW','FOLLOW_UP','OLD'])[1 + g % 3]::"VisitType",
       1 + g % 60, ARRAY['Consultation'], now()
FROM generate_series(1, 150000) g
CROSS JOIN LATERAL (SELECT id FROM users WHERE email = 'doctor@cura.local') d
CROSS JOIN LATERAL (
  SELECT (date_trunc('day', now()) - interval '365 days' + ((g / 72) * interval '1 day') * 7 / 5
          + interval '3 hours' + ((g % 72) * interval '10 minutes')) AS at
) s
JOIN patients p ON p."curaId" = 'CURA-' || (200001 + (g * 7919) % 20000);

-- Visit records for 40k finished appointments.
WITH done AS (
  SELECT id, "patientId", "doctorId", "scheduledAt" FROM appointments
  WHERE status = 'DONE' ORDER BY "scheduledAt" DESC LIMIT 40000
), enc AS (
  INSERT INTO encounters (id, "patientId", "doctorId", "appointmentId", "occurredAt", "signedAt", "updatedAt")
  SELECT gen_random_uuid(), "patientId", "doctorId", id, "scheduledAt", "scheduledAt" + interval '15 minutes', now() FROM done
  RETURNING id
), notes AS (
  INSERT INTO clinical_notes (id, "encounterId", complaints, observations, diagnoses, advice, "updatedAt")
  SELECT gen_random_uuid(), id, ARRAY['Fever','Headache'], ARRAY['BP normal'], ARRAY['Viral fever'], ARRAY['Rest'], now() FROM enc
  RETURNING "encounterId"
)
INSERT INTO prescriptions (id, "encounterId", investigations, "followUpDate", "updatedAt")
SELECT gen_random_uuid(), "encounterId", ARRAY['CBC'], (now() + ((random() * 60)::int || ' days')::interval)::date, now() FROM notes;

COMMIT;
ANALYZE;
