-- AlterTable: add checker fields to adjustments (Makers-Checkers audit trail)
ALTER TABLE "finance_mlm"."adjustments"
  ADD COLUMN "approved_by" TEXT,
  ADD COLUMN "approved_at" TIMESTAMPTZ;
