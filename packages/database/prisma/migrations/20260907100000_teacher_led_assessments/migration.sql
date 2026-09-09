ALTER TABLE "learning"."interactive_sessions"
  ADD COLUMN "assessment_mode" TEXT NOT NULL DEFAULT 'LESSON' CHECK ("assessment_mode" IN ('LESSON', 'PRE', 'POST')),
  ADD COLUMN "assessment_status" TEXT NOT NULL DEFAULT 'LOBBY' CHECK ("assessment_status" IN ('LOBBY', 'RUNNING', 'FINISHED')),
  ADD COLUMN "assessment_revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "assessment_started_at" TIMESTAMPTZ;
ALTER TABLE "learning"."assessment_attempts"
  ADD COLUMN "draft_answers" JSONB,
  ADD COLUMN "assessment_session_id" UUID;
