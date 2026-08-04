-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BKASH', 'NAGAD', 'BANK_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "number" VARCHAR(30) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "paidMinor" INTEGER NOT NULL DEFAULT 0,
    "notes" VARCHAR(600),
    "issuedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "pricingItemId" UUID,
    "description" VARCHAR(200) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitMinor" INTEGER NOT NULL,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" VARCHAR(120),
    "receivedById" UUID,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_settings" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "offsetDays" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "printout_settings" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "documentType" VARCHAR(20) NOT NULL,
    "printerType" VARCHAR(20) NOT NULL DEFAULT 'COLOUR',
    "paperSize" VARCHAR(10) NOT NULL DEFAULT 'A4',
    "orientation" VARCHAR(12) NOT NULL DEFAULT 'PORTRAIT',
    "marginTopMm" INTEGER NOT NULL DEFAULT 50,
    "marginBottomMm" INTEGER NOT NULL DEFAULT 12,
    "marginLeftMm" INTEGER NOT NULL DEFAULT 6,
    "marginRightMm" INTEGER NOT NULL DEFAULT 6,
    "fontScale" INTEGER NOT NULL DEFAULT 100,
    "showHeader" BOOLEAN NOT NULL DEFAULT true,
    "showFooter" BOOLEAN NOT NULL DEFAULT true,
    "headerHtml" VARCHAR(2000),
    "footerHtml" VARCHAR(2000),
    "padImageKey" VARCHAR(512),
    "sectionOrder" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printout_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_form_templates" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charting_templates" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "diagnoses" TEXT[],
    "labOrders" TEXT[],
    "followUpDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charting_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "plan" VARCHAR(20) NOT NULL DEFAULT 'FREE',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_practiceId_status_createdAt_idx" ON "invoices"("practiceId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "invoices_patientId_createdAt_idx" ON "invoices"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_practiceId_number_key" ON "invoices"("practiceId", "number");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "communication_settings_practiceId_category_type_key" ON "communication_settings"("practiceId", "category", "type");

-- CreateIndex
CREATE UNIQUE INDEX "printout_settings_practiceId_documentType_key" ON "printout_settings"("practiceId", "documentType");

-- CreateIndex
CREATE INDEX "consent_form_templates_practiceId_isActive_idx" ON "consent_form_templates"("practiceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "charting_templates_practiceId_name_key" ON "charting_templates"("practiceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_practiceId_key" ON "subscriptions"("practiceId");

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
