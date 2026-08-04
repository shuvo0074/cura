-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DOCTOR', 'ASSISTANT_DOCTOR', 'ADMINISTRATOR', 'RECEPTIONIST', 'FRONT_DESK', 'NONE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'WAITING', 'ENGAGED', 'DONE', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('NEW', 'FOLLOW_UP', 'OLD');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTRATION', 'LOGIN', 'PASSWORD_RESET', 'STAFF_DEVICE', 'PATIENT_CONSENT');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('NID_FRONT', 'NID_BACK', 'MEDICAL_CERTIFICATE', 'DIGITAL_SIGNATURE', 'LAB_REPORT', 'EXTERNAL_PRESCRIPTION', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160),
    "mobile" VARCHAR(20),
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DOCTOR',
    "bmdcNumber" VARCHAR(20),
    "gender" "Gender",
    "dateOfBirth" DATE,
    "bloodGroup" VARCHAR(4),
    "secondaryPhone" VARCHAR(20),
    "avatarUrl" VARCHAR(512),
    "locale" VARCHAR(5) NOT NULL DEFAULT 'en',
    "nidEncrypted" BYTEA,
    "nidFingerprint" VARCHAR(64),
    "emailVerifiedAt" TIMESTAMP(3),
    "mobileVerifiedAt" TIMESTAMP(3),
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "degreeName" VARCHAR(120) NOT NULL,
    "instituteName" VARCHAR(160) NOT NULL,
    "passingYear" INTEGER,
    "country" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "year" INTEGER,
    "issuer" VARCHAR(160),
    "country" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_drafts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practices" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "specialization" VARCHAR(120),
    "contactNumber" VARCHAR(20),
    "email" VARCHAR(160),
    "address" VARCHAR(400),
    "mapsUrl" VARCHAR(512),
    "logoUrl" VARCHAR(512),
    "roomNumber" VARCHAR(40),
    "slotMinutes" INTEGER NOT NULL DEFAULT 10,
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Dhaka',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "practices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_memberships" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "dayOfWeek" SMALLINT NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_closures" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "reason" VARCHAR(240),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "curaId" VARCHAR(20) NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "mobile" VARCHAR(20) NOT NULL,
    "email" VARCHAR(160),
    "gender" "Gender",
    "dateOfBirth" DATE,
    "bloodGroup" VARCHAR(4),
    "address" VARCHAR(400),
    "avatarUrl" VARCHAR(512),
    "occupation" VARCHAR(120),
    "referredBy" VARCHAR(120),
    "searchName" VARCHAR(160) NOT NULL,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "lastVisitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_consents" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "grantedToUserId" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "method" VARCHAR(20) NOT NULL,

    CONSTRAINT "patient_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "visitType" "VisitType" NOT NULL DEFAULT 'NEW',
    "tokenNumber" INTEGER,
    "plannedProcedures" TEXT[],
    "notes" VARCHAR(1000),
    "checkedInAt" TIMESTAMP(3),
    "engagedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" VARCHAR(240),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "appointmentId" UUID,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vitals" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "weightKg" DECIMAL(5,2),
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "pulseBpm" INTEGER,
    "temperatureC" DECIMAL(4,1),
    "respiratoryRate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_notes" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "complaints" TEXT[],
    "observations" TEXT[],
    "diagnoses" TEXT[],
    "advice" TEXT[],
    "notes" VARCHAR(4000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "investigations" TEXT[],
    "followUpDate" DATE,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "drugName" VARCHAR(160) NOT NULL,
    "strength" VARCHAR(40),
    "form" VARCHAR(40),
    "durationDays" INTEGER,
    "morning" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "noon" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "night" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "mealRelation" VARCHAR(10) NOT NULL DEFAULT 'ANY',
    "instruction" VARCHAR(300),

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_assets" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID,
    "patientId" UUID,
    "encounterId" UUID,
    "category" "DocumentCategory" NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "capturedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "document_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "userAgent" VARCHAR(300),
    "ipHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "destination" VARCHAR(160) NOT NULL,
    "subjectId" UUID,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "resourceType" VARCHAR(60) NOT NULL,
    "resourceId" VARCHAR(64),
    "practiceId" UUID,
    "ipHash" VARCHAR(64),
    "userAgent" VARCHAR(300),
    "requestId" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drugs" (
    "id" UUID NOT NULL,
    "practiceId" UUID,
    "name" VARCHAR(160) NOT NULL,
    "form" VARCHAR(40),
    "strength" VARCHAR(40),
    "unit" VARCHAR(20),
    "instruction" VARCHAR(300),
    "searchName" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "drugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_entries" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "value" VARCHAR(300) NOT NULL,
    "searchValue" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "catalog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_items" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "notes" VARCHAR(400),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pricing_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "users_bmdcNumber_key" ON "users"("bmdcNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_nidFingerprint_key" ON "users"("nidFingerprint");

-- CreateIndex
CREATE INDEX "users_isActive_role_idx" ON "users"("isActive", "role");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "qualifications_userId_idx" ON "qualifications"("userId");

-- CreateIndex
CREATE INDEX "awards_userId_idx" ON "awards"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_drafts_userId_key" ON "onboarding_drafts"("userId");

-- CreateIndex
CREATE INDEX "practices_isActive_idx" ON "practices"("isActive");

-- CreateIndex
CREATE INDEX "practice_memberships_userId_isActive_idx" ON "practice_memberships"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "practice_memberships_practiceId_userId_key" ON "practice_memberships"("practiceId", "userId");

-- CreateIndex
CREATE INDEX "practice_sessions_practiceId_dayOfWeek_idx" ON "practice_sessions"("practiceId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "practice_closures_practiceId_startsAt_endsAt_idx" ON "practice_closures"("practiceId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "patients_curaId_key" ON "patients"("curaId");

-- CreateIndex
CREATE INDEX "patients_practiceId_mobile_idx" ON "patients"("practiceId", "mobile");

-- CreateIndex
CREATE INDEX "patients_practiceId_searchName_idx" ON "patients"("practiceId", "searchName");

-- CreateIndex
CREATE INDEX "patients_practiceId_lastVisitAt_idx" ON "patients"("practiceId", "lastVisitAt" DESC);

-- CreateIndex
CREATE INDEX "patients_deletedAt_idx" ON "patients"("deletedAt");

-- CreateIndex
CREATE INDEX "patient_consents_patientId_grantedToUserId_expiresAt_idx" ON "patient_consents"("patientId", "grantedToUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "appointments_doctorId_scheduledAt_idx" ON "appointments"("doctorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "appointments_practiceId_scheduledAt_idx" ON "appointments"("practiceId", "scheduledAt");

-- CreateIndex
CREATE INDEX "appointments_practiceId_status_scheduledAt_idx" ON "appointments"("practiceId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "appointments_patientId_scheduledAt_idx" ON "appointments"("patientId", "scheduledAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "encounters_appointmentId_key" ON "encounters"("appointmentId");

-- CreateIndex
CREATE INDEX "encounters_patientId_occurredAt_idx" ON "encounters"("patientId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "encounters_doctorId_occurredAt_idx" ON "encounters"("doctorId", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "vitals_encounterId_key" ON "vitals"("encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_notes_encounterId_key" ON "clinical_notes"("encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_encounterId_key" ON "prescriptions"("encounterId");

-- CreateIndex
CREATE INDEX "prescription_items_prescriptionId_position_idx" ON "prescription_items"("prescriptionId", "position");

-- CreateIndex
CREATE INDEX "document_assets_patientId_category_idx" ON "document_assets"("patientId", "category");

-- CreateIndex
CREATE INDEX "document_assets_encounterId_idx" ON "document_assets"("encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "otp_challenges_destination_purpose_createdAt_idx" ON "otp_challenges"("destination", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "otp_challenges_expiresAt_idx" ON "otp_challenges"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "drugs_practiceId_searchName_idx" ON "drugs"("practiceId", "searchName");

-- CreateIndex
CREATE INDEX "catalog_entries_practiceId_kind_searchValue_idx" ON "catalog_entries"("practiceId", "kind", "searchValue");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_entries_practiceId_kind_value_key" ON "catalog_entries"("practiceId", "kind", "value");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_items_practiceId_name_key" ON "pricing_items"("practiceId", "name");

-- AddForeignKey
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_drafts" ADD CONSTRAINT "onboarding_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_memberships" ADD CONSTRAINT "practice_memberships_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_memberships" ADD CONSTRAINT "practice_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_closures" ADD CONSTRAINT "practice_closures_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
