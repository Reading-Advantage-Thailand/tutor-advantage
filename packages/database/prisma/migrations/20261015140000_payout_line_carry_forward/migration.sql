-- Clawback carry-forward (owner decision 2026-10-15): a negative period total
-- is carried to the next period instead of being dropped.

-- AlterTable
ALTER TABLE "finance_mlm"."payout_lines" ADD COLUMN     "carry_forward_deducted_minor" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "carry_forward_origin" TEXT,
ADD COLUMN     "carry_forward_out_minor" BIGINT NOT NULL DEFAULT 0;
