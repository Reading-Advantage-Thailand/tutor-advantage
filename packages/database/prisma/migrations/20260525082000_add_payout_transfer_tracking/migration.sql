ALTER TABLE "finance_mlm"."payout_documents"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "provider_transfer_id" TEXT,
  ADD COLUMN "transfer_status" TEXT NOT NULL DEFAULT 'NOT_SENT',
  ADD COLUMN "transfer_failure_code" TEXT,
  ADD COLUMN "transfer_failure_message" TEXT,
  ADD COLUMN "transferred_at" TIMESTAMPTZ;

CREATE INDEX "payout_documents_transfer_status_idx"
  ON "finance_mlm"."payout_documents"("transfer_status");
