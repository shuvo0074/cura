-- Communications' follow-up list: prescriptions due inside a date window.
CREATE INDEX IF NOT EXISTS "prescriptions_followUpDate_idx" ON prescriptions ("followUpDate");

-- Birthday wishes.
--
-- EngagementRepository.birthdaysDue() matches patients whose birthday (month
-- and day, any year) falls in the window. Without this expression index that
-- is a scan of every patient in the practice on each request; the expression
-- here must stay identical to the one in the query or the planner ignores it.
-- Not expressible in schema.prisma, so it lives here like the search index.
CREATE INDEX IF NOT EXISTS "patients_birthday_idx"
  ON patients ("practiceId", ((EXTRACT(MONTH FROM "dateOfBirth") * 100 + EXTRACT(DAY FROM "dateOfBirth"))::int))
  WHERE "dateOfBirth" IS NOT NULL AND "deletedAt" IS NULL;
