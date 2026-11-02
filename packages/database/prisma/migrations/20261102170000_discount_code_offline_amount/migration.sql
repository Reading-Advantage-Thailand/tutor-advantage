-- Offline-paid amount on discount codes (2026-11-02).
-- Students pay the class fee by bank transfer and get a code. Redeeming the
-- code records a SUCCESS payment of this amount, so the tutor and their
-- upline earn commission on it. Null keeps the old behaviour (0 THB payment).

-- AlterTable
ALTER TABLE "finance_mlm"."discount_codes" ADD COLUMN "offline_paid_amount_minor" BIGINT;

ALTER TABLE "finance_mlm"."discount_codes" ADD CONSTRAINT "discount_codes_offline_paid_amount_range"
    CHECK ("offline_paid_amount_minor" IS NULL OR ("offline_paid_amount_minor" >= 0 AND "offline_paid_amount_minor" <= 1000000));
