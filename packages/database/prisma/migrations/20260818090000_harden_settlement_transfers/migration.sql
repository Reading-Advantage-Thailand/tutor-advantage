-- Prevent multiple payout documents from claiming the same provider transfer.
-- PostgreSQL permits multiple NULLs in a unique index, which is required for
-- payout documents before their first Omise transfer is created.
CREATE UNIQUE INDEX "payout_documents_provider_transfer_id_key"
  ON "finance_mlm"."payout_documents" ("provider_transfer_id");
