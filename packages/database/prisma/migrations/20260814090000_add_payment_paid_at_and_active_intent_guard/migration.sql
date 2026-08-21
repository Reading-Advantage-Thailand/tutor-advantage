ALTER TABLE "finance_mlm"."payment_intents"
  ADD COLUMN "paid_at" TIMESTAMPTZ;

UPDATE "finance_mlm"."payment_intents" AS intent
SET "paid_at" = paid_events."paid_at"
FROM (
  SELECT
    payment_intent_id,
    MAX(occurred_at) AS "paid_at"
  FROM "finance_mlm"."payment_events"
  WHERE event_type ILIKE '%successful%'
     OR raw_payload->>'status' = 'successful'
     OR raw_payload->'data'->>'status' = 'successful'
     OR raw_payload->>'paid' = 'true'
     OR raw_payload->'data'->>'paid' = 'true'
  GROUP BY payment_intent_id
) AS paid_events
WHERE intent.payment_intent_id = paid_events.payment_intent_id
  AND intent.status = 'SUCCESS';

CREATE INDEX "payment_intents_status_paid_at_idx"
  ON "finance_mlm"."payment_intents" ("status", "paid_at");

-- Older payment flows could leave multiple non-FAILED intents for the same
-- enrollment target. Retire older duplicates before enforcing the invariant.
-- Keep a successful intent ahead of a pending one, then choose the most
-- recently updated/created record. This preserves data for audit/recovery and
-- does not delete any payment intent.
WITH ranked_enrollment_intents AS (
  SELECT
    intent."payment_intent_id",
    ROW_NUMBER() OVER (
      PARTITION BY intent."enrollment_id", intent."student_user_id"
      ORDER BY
        CASE WHEN intent."status" = 'SUCCESS' THEN 0 ELSE 1 END,
        intent."updated_at" DESC,
        intent."created_at" DESC,
        intent."payment_intent_id" DESC
    ) AS duplicate_rank
  FROM "finance_mlm"."payment_intents" AS intent
  WHERE intent."enrollment_package_id" IS NULL
    AND intent."status" <> 'FAILED'
)
UPDATE "finance_mlm"."payment_intents" AS intent
SET "status" = 'FAILED',
    "updated_at" = CURRENT_TIMESTAMP
FROM ranked_enrollment_intents AS ranked
WHERE intent."payment_intent_id" = ranked."payment_intent_id"
  AND ranked.duplicate_rank > 1;

WITH ranked_package_intents AS (
  SELECT
    intent."payment_intent_id",
    ROW_NUMBER() OVER (
      PARTITION BY intent."enrollment_id", intent."enrollment_package_id", intent."student_user_id"
      ORDER BY
        CASE WHEN intent."status" = 'SUCCESS' THEN 0 ELSE 1 END,
        intent."updated_at" DESC,
        intent."created_at" DESC,
        intent."payment_intent_id" DESC
    ) AS duplicate_rank
  FROM "finance_mlm"."payment_intents" AS intent
  WHERE intent."enrollment_package_id" IS NOT NULL
    AND intent."status" <> 'FAILED'
)
UPDATE "finance_mlm"."payment_intents" AS intent
SET "status" = 'FAILED',
    "updated_at" = CURRENT_TIMESTAMP
FROM ranked_package_intents AS ranked
WHERE intent."payment_intent_id" = ranked."payment_intent_id"
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX "payment_intents_active_enrollment_key"
  ON "finance_mlm"."payment_intents" ("enrollment_id", "student_user_id")
  WHERE "enrollment_package_id" IS NULL AND "status" <> 'FAILED';

CREATE UNIQUE INDEX "payment_intents_active_package_key"
  ON "finance_mlm"."payment_intents" ("enrollment_id", "enrollment_package_id", "student_user_id")
  WHERE "enrollment_package_id" IS NOT NULL AND "status" <> 'FAILED';
