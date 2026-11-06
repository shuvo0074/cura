-- Activity log screens: one clinic's rows, and rows of one action, newest first.
CREATE INDEX "audit_logs_practiceId_createdAt_idx" ON "audit_logs"("practiceId", "createdAt" DESC);
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);
