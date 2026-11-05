-- Pharmacies, managed by their owners on Cura Dashboard.
CREATE TABLE "pharmacies" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phones" JSONB NOT NULL DEFAULT '[]',
    "openingHours" TEXT,
    "homeDelivery" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pharmacies_ownerId_idx" ON "pharmacies"("ownerId");

ALTER TABLE "pharmacies" ADD CONSTRAINT "pharmacies_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
