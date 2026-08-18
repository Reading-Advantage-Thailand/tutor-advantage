-- Freeze the payout identity reviewed for a settlement line.
ALTER TABLE "identity"."users"
  ADD COLUMN IF NOT EXISTS "payout_identity_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "finance_mlm"."payout_lines"
  ADD COLUMN IF NOT EXISTS "payout_identity_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "finance_mlm"."payout_lines"
  ADD COLUMN IF NOT EXISTS "recipient_snapshot" TEXT;

ALTER TABLE "finance_mlm"."adjustments"
  ADD COLUMN IF NOT EXISTS "volume_minor" BIGINT;

-- A student may submit a phase only once. Rewound phases are review-only and
-- therefore must not create a second answer row for the same phase.
CREATE UNIQUE INDEX IF NOT EXISTS "session_answers_session_student_phase_key"
  ON "learning"."session_answers" ("session_id", "student_user_id", "phase");

-- There is one canonical settlement run per accounting period. Rejected or
-- adjustment-pending runs are refreshed in place by the service.
CREATE UNIQUE INDEX IF NOT EXISTS "settlement_runs_period_month_key"
  ON "finance_mlm"."settlement_runs" ("period_month");
