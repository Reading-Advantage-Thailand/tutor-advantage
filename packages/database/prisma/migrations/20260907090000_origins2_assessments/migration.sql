CREATE TABLE "learning"."assessment_windows" (
  "class_book_cycle_id" UUID PRIMARY KEY REFERENCES "learning"."class_book_cycles"("class_book_cycle_id") ON DELETE CASCADE ON UPDATE CASCADE,
  "post_opened_at" TIMESTAMPTZ,
  "opened_by" UUID
);
CREATE TABLE "learning"."assessment_attempts" (
  "attempt_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "class_book_cycle_id" UUID NOT NULL REFERENCES "learning"."class_book_cycles"("class_book_cycle_id") ON DELETE CASCADE ON UPDATE CASCADE,
  "student_user_id" UUID NOT NULL REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "stage" TEXT NOT NULL CHECK ("stage" IN ('PRE', 'POST')),
  "form_version" TEXT NOT NULL,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ,
  "answers" JSONB,
  "scores" JSONB,
  "total" INTEGER CHECK ("total" BETWEEN 0 AND 15),
  "teacher_comment" TEXT,
  "commented_at" TIMESTAMPTZ,
  "commented_by" UUID,
  CONSTRAINT "assessment_submission_complete" CHECK (("submitted_at" IS NULL AND "total" IS NULL AND "answers" IS NULL AND "scores" IS NULL) OR ("submitted_at" IS NOT NULL AND "total" IS NOT NULL AND "answers" IS NOT NULL AND "scores" IS NOT NULL))
);
CREATE UNIQUE INDEX "assessment_attempts_class_book_cycle_id_student_user_id_sta_key" ON "learning"."assessment_attempts"("class_book_cycle_id", "student_user_id", "stage");
CREATE INDEX "assessment_attempts_student_user_id_submitted_at_idx" ON "learning"."assessment_attempts"("student_user_id", "submitted_at");
