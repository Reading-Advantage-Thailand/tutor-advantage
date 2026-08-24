-- PaymentIntent.paid_at is the accounting timestamp for settlement volume.
-- Successful intents created before paid_at was introduced may not have a
-- successful event to backfill from, so retain their last persisted update
-- time instead of excluding them from every future settlement.
UPDATE "finance_mlm"."payment_intents"
SET "paid_at" = "updated_at"
WHERE "status" = 'SUCCESS'
  AND "paid_at" IS NULL;
