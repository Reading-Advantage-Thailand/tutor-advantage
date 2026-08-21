-- Recalculate persisted lesson totals from the canonical answer rows.
-- This removes score inflation left by legacy duplicate submissions that were
-- removed before the session-answer uniqueness constraint was created.
UPDATE "learning"."session_participants" AS participant
SET "score" = COALESCE(
  (
    SELECT SUM(answer."score")::INTEGER
    FROM "learning"."session_answers" AS answer
    WHERE answer."session_id" = participant."session_id"
      AND answer."student_user_id" = participant."student_user_id"
  ),
  0
);
