-- Ambulance requests patients send through Cura Website to an ambulance service with an owner.
CREATE TYPE "AmbulanceRequestStatus" AS ENUM ('NEW', 'ACCEPTED', 'COMPLETED', 'DECLINED', 'CANCELLED');

CREATE TABLE "ambulance_requests" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "status" "AmbulanceRequestStatus" NOT NULL DEFAULT 'NEW',
    "patientName" VARCHAR(120) NOT NULL,
    "contactPhone" VARCHAR(20) NOT NULL,
    "pickupAddress" VARCHAR(300) NOT NULL,
    "destination" VARCHAR(200),
    "note" VARCHAR(500),
    "pickupAt" TIMESTAMP(3),
    "ownerMessage" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulance_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ambulance_requests_vendorId_createdAt_idx" ON "ambulance_requests"("vendorId", "createdAt");
CREATE INDEX "ambulance_requests_accountId_createdAt_idx" ON "ambulance_requests"("accountId", "createdAt");

ALTER TABLE "ambulance_requests" ADD CONSTRAINT "ambulance_requests_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "ambulance_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ambulance_requests" ADD CONSTRAINT "ambulance_requests_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "patient_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
