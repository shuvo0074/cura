-- Pharmacy stock lists, and prescriptions patients send to a pharmacy to collect.
CREATE TYPE "PharmacyOrderStatus" AS ENUM ('NEW', 'READY', 'COLLECTED', 'CANNOT_FILL', 'CANCELLED');

CREATE TABLE "pharmacy_stock_items" (
    "id" UUID NOT NULL,
    "pharmacyId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "strength" VARCHAR(40),
    "form" VARCHAR(40),
    "priceMinor" INTEGER,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_stock_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pharmacy_orders" (
    "id" UUID NOT NULL,
    "pharmacyId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "prescriptionId" UUID,
    "status" "PharmacyOrderStatus" NOT NULL DEFAULT 'NEW',
    "patientName" VARCHAR(120) NOT NULL,
    "patientPhone" VARCHAR(20),
    "doctorName" VARCHAR(120) NOT NULL,
    "prescribedAt" TIMESTAMP(3) NOT NULL,
    "items" JSONB NOT NULL,
    "note" VARCHAR(500),
    "reason" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pharmacy_stock_items_pharmacyId_name_idx" ON "pharmacy_stock_items"("pharmacyId", "name");
CREATE INDEX "pharmacy_orders_pharmacyId_createdAt_idx" ON "pharmacy_orders"("pharmacyId", "createdAt");
CREATE INDEX "pharmacy_orders_accountId_createdAt_idx" ON "pharmacy_orders"("accountId", "createdAt");
CREATE INDEX "pharmacy_orders_prescriptionId_idx" ON "pharmacy_orders"("prescriptionId");

ALTER TABLE "pharmacy_stock_items" ADD CONSTRAINT "pharmacy_stock_items_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pharmacy_orders" ADD CONSTRAINT "pharmacy_orders_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pharmacy_orders" ADD CONSTRAINT "pharmacy_orders_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "patient_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pharmacy_orders" ADD CONSTRAINT "pharmacy_orders_prescriptionId_fkey"
  FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
