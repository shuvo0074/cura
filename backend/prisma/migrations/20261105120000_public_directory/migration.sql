-- CreateEnum
CREATE TYPE "DirectoryRole" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationKind" AS ENUM ('CLAIM', 'NEW');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProfileItemKind" AS ENUM ('POSITION', 'QUALIFICATION', 'PUBLICATION', 'MEMBERSHIP', 'AWARD');

-- CreateEnum
CREATE TYPE "SerialBookingStatus" AS ENUM ('CONFIRMED', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PUBLIC_USER';

-- CreateTable
CREATE TABLE "user_directory_roles" (
    "userId" UUID NOT NULL,
    "role" "DirectoryRole" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_directory_roles_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "patient_accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "division" TEXT,
    "address" TEXT,
    "hotline" TEXT,
    "photo" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "website" TEXT,
    "doctorCount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "type" TEXT,
    "services" JSONB,
    "beds" JSONB,
    "tests" JSONB,
    "facilities" JSONB,
    "paymentMethods" JSONB,
    "openingHours" TEXT,
    "visitingHours" TEXT,
    "sourceUrl" TEXT,
    "verifiedOn" DATE,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_listings" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "department" TEXT,
    "experience" TEXT,
    "chamber" TEXT,
    "workplace" TEXT,
    "fees" INTEGER,
    "followupFees" INTEGER DEFAULT 300,
    "city" TEXT,
    "division" TEXT,
    "hospitalId" UUID,
    "phone" TEXT,
    "photo" TEXT,
    "rating" DOUBLE PRECISION,
    "about" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "website" TEXT,
    "gender" VARCHAR(10),
    "genderIsDemo" BOOLEAN NOT NULL DEFAULT false,
    "bmdcNo" TEXT,
    "bmdcVerifiedAt" TIMESTAMP(3),
    "education" TEXT,
    "languages" TEXT,
    "consultingHours" TEXT,
    "address" TEXT,
    "clinicalExpertise" TEXT[],
    "treatments" TEXT[],
    "weeklySchedule" JSONB,
    "headline" TEXT,
    "slug" TEXT,
    "practicingSince" SMALLINT,
    "profileUpdatedAt" TIMESTAMP(3),
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "sourceUrl" TEXT,
    "verifiedOn" DATE,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_vendors" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "baseArea" TEXT,
    "address" TEXT,
    "addressBn" TEXT,
    "phones" JSONB NOT NULL DEFAULT '[]',
    "categories" JSONB NOT NULL DEFAULT '[]',
    "features" JSONB NOT NULL DEFAULT '[]',
    "dhakaWide" BOOLEAN NOT NULL DEFAULT false,
    "serviceAreas" JSONB NOT NULL DEFAULT '[]',
    "fares" JSONB NOT NULL DEFAULT '{}',
    "sourceUrl" TEXT,
    "sourceCheckedOn" DATE,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ambulance_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "icon" TEXT,
    "description" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "image" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptoms" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "description" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "image" TEXT,
    "specialties" JSONB NOT NULL DEFAULT '[]',
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "doctor_verifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "doctorId" UUID,
    "kind" "VerificationKind" NOT NULL,
    "bmdcNo" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" UUID,

    CONSTRAINT "doctor_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_profile_items" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "kind" "ProfileItemKind" NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "location" TEXT,
    "startYear" SMALLINT,
    "endYear" SMALLINT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_profile_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_endorsements" (
    "doctorId" UUID NOT NULL,
    "endorserDoctorId" UUID NOT NULL,
    "skill" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_endorsements_pkey" PRIMARY KEY ("doctorId","endorserDoctorId","skill")
);

-- CreateTable
CREATE TABLE "serial_bookings" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "bookingDate" DATE NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "status" "SerialBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "venue" TEXT NOT NULL,
    "sessionTime" TEXT NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serial_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_reviews" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "venue" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_daily_stats" (
    "doctorId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "doctor_daily_stats_pkey" PRIMARY KEY ("doctorId","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_accounts_userId_key" ON "patient_accounts"("userId");

-- CreateIndex
CREATE INDEX "hospitals_hidden_type_idx" ON "hospitals"("hidden", "type");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_listings_userId_key" ON "doctor_listings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_listings_bmdcNo_key" ON "doctor_listings"("bmdcNo");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_listings_slug_key" ON "doctor_listings"("slug");

-- CreateIndex
CREATE INDEX "doctor_listings_hidden_specialty_idx" ON "doctor_listings"("hidden", "specialty");

-- CreateIndex
CREATE INDEX "doctor_listings_hidden_division_idx" ON "doctor_listings"("hidden", "division");

-- CreateIndex
CREATE INDEX "doctor_listings_hospitalId_idx" ON "doctor_listings"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "ambulance_vendors_slug_key" ON "ambulance_vendors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_slug_key" ON "specialties"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_name_key" ON "specialties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "symptoms_slug_key" ON "symptoms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "symptoms_name_key" ON "symptoms"("name");

-- CreateIndex
CREATE INDEX "doctor_verifications_status_submittedAt_idx" ON "doctor_verifications"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "doctor_verifications_doctorId_status_idx" ON "doctor_verifications"("doctorId", "status");

-- CreateIndex
CREATE INDEX "doctor_profile_items_doctorId_kind_idx" ON "doctor_profile_items"("doctorId", "kind");

-- CreateIndex
CREATE INDEX "serial_bookings_patientId_bookingDate_idx" ON "serial_bookings"("patientId", "bookingDate" DESC);

-- CreateIndex
CREATE INDEX "serial_bookings_doctorId_bookingDate_idx" ON "serial_bookings"("doctorId", "bookingDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_reviews_bookingId_key" ON "doctor_reviews"("bookingId");

-- CreateIndex
CREATE INDEX "doctor_reviews_doctorId_createdAt_idx" ON "doctor_reviews"("doctorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "call_logs_doctorId_createdAt_idx" ON "call_logs"("doctorId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_directory_roles" ADD CONSTRAINT "user_directory_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_accounts" ADD CONSTRAINT "patient_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_listings" ADD CONSTRAINT "doctor_listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_listings" ADD CONSTRAINT "doctor_listings_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_verifications" ADD CONSTRAINT "doctor_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_verifications" ADD CONSTRAINT "doctor_verifications_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_verifications" ADD CONSTRAINT "doctor_verifications_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_profile_items" ADD CONSTRAINT "doctor_profile_items_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_endorsements" ADD CONSTRAINT "doctor_endorsements_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_endorsements" ADD CONSTRAINT "doctor_endorsements_endorserDoctorId_fkey" FOREIGN KEY ("endorserDoctorId") REFERENCES "doctor_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_bookings" ADD CONSTRAINT "serial_bookings_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_bookings" ADD CONSTRAINT "serial_bookings_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "serial_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_daily_stats" ADD CONSTRAINT "doctor_daily_stats_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rules Prisma cannot express in the schema.
CREATE UNIQUE INDEX "doctor_verifications_one_pending"
  ON "doctor_verifications" ("userId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "serial_bookings_session_serial"
  ON "serial_bookings" ("doctorId", "bookingDate", "venue", "sessionTime", "serialNo");
CREATE UNIQUE INDEX "serial_bookings_one_active_per_patient"
  ON "serial_bookings" ("patientId", "doctorId", "bookingDate", "venue", "sessionTime")
  WHERE "status" <> 'CANCELLED';
ALTER TABLE "doctor_endorsements" ADD CONSTRAINT "doctor_endorsements_not_self"
  CHECK ("doctorId" <> "endorserDoctorId");
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_rating_range"
  CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "doctor_listings" ADD CONSTRAINT "doctor_listings_slug_format"
  CHECK ("slug" ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$');
ALTER TABLE "doctor_listings" ADD CONSTRAINT "doctor_listings_gender"
  CHECK ("gender" IN ('male', 'female'));
