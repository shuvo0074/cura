-- One doctor table, and the user types: super admin, clinic owner, doctor, clinic
-- staff, ambulance owner, pharmacy owner and patient.
--
-- Everything in the database at this point is demo data, so doctors with no user
-- are removed rather than given invented accounts.

-- Roles
ALTER TYPE "DirectoryRole" RENAME VALUE 'ADMIN' TO 'SUPER_ADMIN';
ALTER TYPE "DirectoryRole" ADD VALUE IF NOT EXISTS 'AMBULANCE_OWNER';
ALTER TYPE "DirectoryRole" ADD VALUE IF NOT EXISTS 'PHARMACY_OWNER';
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'DOCTOR_CLAIM';

-- A doctor an admin added has no password until they sign up.
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "doctor_listings" ADD COLUMN "pendingApproval" BOOLEAN NOT NULL DEFAULT false;

-- Doctors with no user cannot exist any more.
DELETE FROM "doctor_reviews" WHERE "doctorId" IN (SELECT id FROM "doctor_listings" WHERE "userId" IS NULL);
DELETE FROM "serial_bookings" WHERE "doctorId" IN (SELECT id FROM "doctor_listings" WHERE "userId" IS NULL);
DELETE FROM "doctor_listings" WHERE "userId" IS NULL;

-- Every doctor user gets a doctor row. One already working in a clinic is public;
-- one who only signed up waits for an admin.
INSERT INTO "doctor_listings" (id, "userId", name, specialty, phone, "bmdcNo", chamber, "followupFees", hidden, "pendingApproval")
SELECT
  gen_random_uuid(),
  u.id,
  CASE WHEN u."fullName" ~* '^dr\.?\s' THEN u."fullName" ELSE 'Dr. ' || u."fullName" END,
  'General Physician',
  regexp_replace(u.mobile, '^\+?88', ''),
  CASE WHEN EXISTS (SELECT 1 FROM "doctor_listings" d WHERE d."bmdcNo" = u."bmdcNumber") THEN NULL ELSE u."bmdcNumber" END,
  clinic.name,
  NULL,
  clinic.name IS NULL,
  clinic.name IS NULL
FROM "users" u
LEFT JOIN LATERAL (
  SELECT p.name
  FROM "practice_memberships" m
  JOIN "practices" p ON p.id = m."practiceId"
  WHERE m."userId" = u.id
  ORDER BY m."createdAt"
  LIMIT 1
) clinic ON true
WHERE u.role = 'DOCTOR'
  AND u."deletedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "doctor_listings" d WHERE d."userId" = u.id);

INSERT INTO "user_directory_roles" ("userId", role)
SELECT "userId", 'DOCTOR' FROM "doctor_listings"
ON CONFLICT DO NOTHING;

-- The doctor table, tied to its user.
ALTER TABLE "doctor_listings" DROP CONSTRAINT "doctor_listings_userId_fkey";
ALTER TABLE "doctor_listings" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "doctor_listings" ADD CONSTRAINT "doctor_listings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "doctor_listings" RENAME TO "doctors";
DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT conname AS name FROM pg_constraint
    WHERE conrelid = '"doctors"'::regclass AND conname LIKE 'doctor_listings_%'
  LOOP
    EXECUTE format('ALTER TABLE "doctors" RENAME CONSTRAINT %I TO %I', item.name, replace(item.name, 'doctor_listings_', 'doctors_'));
  END LOOP;
  FOR item IN
    SELECT indexname AS name FROM pg_indexes
    WHERE tablename = 'doctors' AND indexname LIKE 'doctor_listings_%'
  LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I', item.name, replace(item.name, 'doctor_listings_', 'doctors_'));
  END LOOP;
END $$;

-- A patient's website account, linked to each clinic they joined.
ALTER TABLE "patients" ADD COLUMN "accountId" UUID;
CREATE UNIQUE INDEX "patients_practiceId_accountId_key" ON "patients"("practiceId", "accountId");
ALTER TABLE "patients" ADD CONSTRAINT "patients_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "patient_accounts"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Ambulance owners.
ALTER TABLE "ambulance_vendors" ADD COLUMN "ownerId" UUID;
ALTER TABLE "ambulance_vendors" ADD CONSTRAINT "ambulance_vendors_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"(id) ON DELETE SET NULL ON UPDATE CASCADE;
