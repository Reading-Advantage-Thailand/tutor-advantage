ALTER TABLE "learning"."assessment_windows"
  ADD COLUMN "assessment_window_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "article_id" TEXT;

ALTER TABLE "learning"."assessment_attempts"
  ADD COLUMN "article_id" TEXT;

UPDATE "learning"."assessment_attempts" AS attempt
SET "article_id" = COALESCE(
  (
    SELECT session."article_id"
    FROM "learning"."interactive_sessions" AS session
    WHERE session."session_id" = attempt."assessment_session_id"
    LIMIT 1
  ),
  'legacy-primary-origins2'
);

UPDATE "learning"."assessment_windows" AS window
SET "article_id" = COALESCE(
  (
    SELECT attempt."article_id"
    FROM "learning"."assessment_attempts" AS attempt
    WHERE attempt."class_book_cycle_id" = window."class_book_cycle_id"
    ORDER BY attempt."started_at" ASC
    LIMIT 1
  ),
  'legacy-primary-origins2'
);

ALTER TABLE "learning"."assessment_attempts"
  ALTER COLUMN "article_id" SET NOT NULL;

ALTER TABLE "learning"."assessment_windows"
  ALTER COLUMN "article_id" SET NOT NULL,
  DROP CONSTRAINT "assessment_windows_pkey",
  ADD CONSTRAINT "assessment_windows_pkey" PRIMARY KEY ("assessment_window_id");

DROP INDEX "learning"."assessment_attempts_class_book_cycle_id_student_user_id_sta_key";

CREATE UNIQUE INDEX "assessment_windows_class_book_cycle_id_article_id_key"
  ON "learning"."assessment_windows"("class_book_cycle_id", "article_id");

CREATE UNIQUE INDEX "assessment_attempts_class_book_cycle_id_article_id_student__key"
  ON "learning"."assessment_attempts"("class_book_cycle_id", "article_id", "student_user_id", "stage");
