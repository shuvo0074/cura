-- AlterTable
ALTER TABLE "practice_memberships" ADD COLUMN     "notifyAppointmentEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyAppointmentSms" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyScheduleEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyScheduleSms" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "practices" ADD COLUMN     "addressLine1" VARCHAR(200),
ADD COLUMN     "binNumber" VARCHAR(40),
ADD COLUMN     "city" VARCHAR(80),
ADD COLUMN     "country" VARCHAR(80) NOT NULL DEFAULT 'Bangladesh',
ADD COLUMN     "hideCancelledInvoices" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hideCancelledPayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locality" VARCHAR(120),
ADD COLUMN     "postCode" VARCHAR(12),
ADD COLUMN     "showTodayFirst" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smsLanguage" VARCHAR(5) NOT NULL DEFAULT 'en',
ADD COLUMN     "website" VARCHAR(200);

-- CreateTable
CREATE TABLE "email_settings" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "section" VARCHAR(10) NOT NULL,
    "title" VARCHAR(160),
    "leftText" VARCHAR(1000),
    "rightText" VARCHAR(1000),
    "includeLogo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_settings_practiceId_section_key" ON "email_settings"("practiceId", "section");

-- AddForeignKey
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
