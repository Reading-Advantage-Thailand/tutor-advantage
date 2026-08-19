ALTER TABLE "finance_mlm"."payment_intents"
  ADD COLUMN IF NOT EXISTS "earning_tutor_user_id" UUID;

CREATE INDEX IF NOT EXISTS "payment_intents_earning_tutor_user_id_idx"
  ON "finance_mlm"."payment_intents" ("earning_tutor_user_id");
