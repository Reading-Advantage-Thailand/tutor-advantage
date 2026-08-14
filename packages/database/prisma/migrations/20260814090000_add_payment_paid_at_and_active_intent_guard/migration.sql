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

CREATE UNIQUE INDEX "payment_intents_active_enrollment_key"
  ON "finance_mlm"."payment_intents" ("enrollment_id", "student_user_id")
  WHERE "enrollment_package_id" IS NULL AND "status" <> 'FAILED';

CREATE UNIQUE INDEX "payment_intents_active_package_key"
  ON "finance_mlm"."payment_intents" ("enrollment_id", "enrollment_package_id", "student_user_id")
  WHERE "enrollment_package_id" IS NOT NULL AND "status" <> 'FAILED';
