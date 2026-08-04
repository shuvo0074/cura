-- Runs after the base schema migration, because it depends on the tables and
-- columns that migration creates.
--
-- Column identifiers are quoted camelCase: the Prisma models map table names
-- via @@map but leave field names untouched, so Postgres stores them
-- case-sensitively and unquoted references would fold to lowercase and fail.

-- Cura ID allocation.
--
-- A sequence rather than `SELECT count(*) + 1` is what makes concurrent patient
-- intake safe: two receptionists saving at the same instant receive distinct
-- ids without taking a lock or retrying on a unique violation.
CREATE SEQUENCE IF NOT EXISTS cura_patient_seq
  START WITH 10000
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Case-insensitive prefix search on patient names.
--
-- PatientRepository.search() issues `searchName LIKE 'term%'`. Under a non-C
-- collation the default btree operator class cannot serve that predicate, so
-- text_pattern_ops is required for the index to be used rather than silently
-- degrading to a sequential scan as the table grows.
CREATE INDEX IF NOT EXISTS "patients_searchName_prefix_idx"
  ON patients ("practiceId", "searchName" text_pattern_ops);

-- Partial index for the calendar's hot path.
--
-- Only appointments that still occupy a slot participate in overlap checks, so
-- cancelled and no-show rows are excluded from the index entirely — it stays
-- small and the double-booking guard stays fast as history accumulates.
CREATE INDEX IF NOT EXISTS "appointments_active_slot_idx"
  ON appointments ("doctorId", "scheduledAt", "endsAt")
  WHERE status IN ('SCHEDULED', 'WAITING', 'ENGAGED');

-- The audit trail is append-only by intent. Enforcing that at the database
-- level means an application-layer bug cannot rewrite history. Applied by the
-- operator against the runtime role, which is not the migration role:
--   REVOKE UPDATE, DELETE ON audit_logs FROM cura_app;
