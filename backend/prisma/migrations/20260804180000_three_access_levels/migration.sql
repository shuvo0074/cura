-- Collapse the access levels to three: ADMINISTRATOR, DOCTOR, DESK_STAFF.
--
-- Existing rows are mapped rather than dropped: assistant doctors are still
-- clinicians, and both front-desk grades become one desk role. NONE had no
-- permissions at all, and membership.isActive already expresses "no access",
-- so those rows fold into DESK_STAFF with their membership left inactive.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('ADMINISTRATOR', 'DOCTOR', 'DESK_STAFF');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole"
  USING (CASE "role"::text
    WHEN 'ADMINISTRATOR'    THEN 'ADMINISTRATOR'
    WHEN 'DOCTOR'           THEN 'DOCTOR'
    WHEN 'ASSISTANT_DOCTOR' THEN 'DOCTOR'
    ELSE 'DESK_STAFF'
  END)::"UserRole";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'DOCTOR';

ALTER TABLE "practice_memberships"
  ALTER COLUMN "role" TYPE "UserRole"
  USING (CASE "role"::text
    WHEN 'ADMINISTRATOR'    THEN 'ADMINISTRATOR'
    WHEN 'DOCTOR'           THEN 'DOCTOR'
    WHEN 'ASSISTANT_DOCTOR' THEN 'DOCTOR'
    ELSE 'DESK_STAFF'
  END)::"UserRole";

-- Members who previously held NONE keep the row but lose access.
UPDATE "practice_memberships" m
   SET "isActive" = false
  FROM "users" u
 WHERE u.id = m."userId" AND u."deletedAt" IS NOT NULL;

DROP TYPE "UserRole_old";
