-- CreateTable
CREATE TABLE "patient_feedback" (
    "id" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(1000),
    "reply" VARCHAR(1000),
    "repliedAt" TIMESTAMP(3),
    "repliedById" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_feedback_practiceId_createdAt_idx" ON "patient_feedback"("practiceId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "patient_feedback" ADD CONSTRAINT "patient_feedback_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_feedback" ADD CONSTRAINT "patient_feedback_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
