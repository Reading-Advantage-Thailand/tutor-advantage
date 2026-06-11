-- Replace the hand-written partial unique index from 20260511120000_add_tax_documents
-- with the full unique index Prisma expects for @unique. Behaviour is identical:
-- Postgres already treats NULLs as distinct in unique indexes, so the partial
-- WHERE clause added nothing — but the mismatch made every `prisma migrate diff`
-- report permanent drift and would make a future auto-generated migration fail
-- on the duplicate index name.
DROP INDEX IF EXISTS "finance_mlm"."payment_events_provider_event_id_key";
CREATE UNIQUE INDEX "payment_events_provider_event_id_key"
  ON "finance_mlm"."payment_events"("provider_event_id");
