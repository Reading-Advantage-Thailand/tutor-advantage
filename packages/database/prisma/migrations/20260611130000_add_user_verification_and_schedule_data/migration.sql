-- Backfill columns that existed in schema.prisma but never had a migration
-- (previously applied to some dev databases via `prisma db push`).
-- Written idempotently so databases that already have them are unaffected.

-- Tutor identity-verification documents
ALTER TABLE "identity"."users" ADD COLUMN IF NOT EXISTS "id_card_image_url" TEXT;
ALTER TABLE "identity"."users" ADD COLUMN IF NOT EXISTS "bank_book_image_url" TEXT;
ALTER TABLE "identity"."users" ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "identity"."users" ADD COLUMN IF NOT EXISTS "verification_comment" TEXT;

-- Flexible weekly schedule payload for classes
ALTER TABLE "learning"."classes" ADD COLUMN IF NOT EXISTS "schedule_data" JSONB;

-- Unique guard for payment provider events (declared @unique in schema)
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_provider_event_id_key"
  ON "finance_mlm"."payment_events"("provider_event_id");
