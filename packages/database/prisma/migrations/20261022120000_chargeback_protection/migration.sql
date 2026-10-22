-- Chargeback / refund protection (2026-10-22).
--  * refunded_amount_minor: partial and full refunds reduce settlement volume.
--  * card_fingerprint: same-card detection across students.
--  * dispute_id: latest Omise dispute (chargeback) for the charge.
--  * commission_settlement_run_id: the approved run that paid commission on
--    this payment. Null = not paid yet (still inside the hold period), so a
--    refund or chargeback only needs to exclude it, not claw anything back.

-- AlterTable
ALTER TABLE "finance_mlm"."payment_intents" ADD COLUMN     "card_fingerprint" TEXT,
ADD COLUMN     "commission_settlement_run_id" UUID,
ADD COLUMN     "dispute_id" TEXT,
ADD COLUMN     "refunded_amount_minor" BIGINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "payment_intents_card_fingerprint_idx" ON "finance_mlm"."payment_intents"("card_fingerprint");

-- CreateIndex
CREATE INDEX "payment_intents_commission_settlement_run_id_idx" ON "finance_mlm"."payment_intents"("commission_settlement_run_id");

-- CreateIndex
CREATE INDEX "fraud_flags_target_id_status_idx" ON "finance_mlm"."fraud_flags"("target_id", "status");

-- Backfill: before this change a payment was settled in the run for the ICT
-- month it was paid in. Stamp successful payments already covered by an
-- APPROVED run so the new hold-period selection never pays them twice.
UPDATE "finance_mlm"."payment_intents" AS p
SET "commission_settlement_run_id" = r."settlement_run_id"
FROM "finance_mlm"."settlement_runs" AS r
WHERE r."status" = 'APPROVED'
  AND p."commission_settlement_run_id" IS NULL
  AND p."paid_at" IS NOT NULL
  AND p."status" = 'SUCCESS'
  AND to_char(p."paid_at" AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM') = r."period_month";
