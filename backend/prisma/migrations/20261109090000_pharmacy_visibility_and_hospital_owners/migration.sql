-- Hospital owners: an account a super admin links to a hospital or diagnostic centre.
ALTER TYPE "DirectoryRole" ADD VALUE IF NOT EXISTS 'HOSPITAL_OWNER';

ALTER TABLE "hospitals" ADD COLUMN "ownerId" UUID;
CREATE INDEX "hospitals_ownerId_idx" ON "hospitals"("ownerId");
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pharmacies on Cura Website. Existing pharmacies stay visible: only a super
-- admin can make someone a pharmacy owner, so they are already known accounts.
-- New ones an owner adds start hidden (set by the API) until a super admin shows them.
ALTER TABLE "pharmacies" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
