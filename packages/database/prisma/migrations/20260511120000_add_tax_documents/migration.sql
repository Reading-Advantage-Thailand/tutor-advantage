ALTER TABLE "finance_mlm"."payment_events"
ADD COLUMN IF NOT EXISTS "provider_event_id" TEXT;

ALTER TABLE "learning"."classes"
ADD COLUMN IF NOT EXISTS "package_price_minor" BIGINT NOT NULL DEFAULT 250000;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_provider_event_id_key"
ON "finance_mlm"."payment_events"("provider_event_id")
WHERE "provider_event_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "finance_mlm"."payment_receipts" (
  "receipt_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_intent_id" UUID NOT NULL,
  "student_user_id" UUID NOT NULL,
  "receipt_number" TEXT NOT NULL,
  "gross_amount_minor" BIGINT NOT NULL,
  "vat_amount_minor" BIGINT NOT NULL,
  "net_amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("receipt_id"),
  CONSTRAINT "payment_receipts_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id")
    REFERENCES "finance_mlm"."payment_intents"("payment_intent_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_receipts_payment_intent_id_key"
ON "finance_mlm"."payment_receipts"("payment_intent_id");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_receipts_receipt_number_key"
ON "finance_mlm"."payment_receipts"("receipt_number");

ALTER TABLE "finance_mlm"."payout_lines"
ADD COLUMN IF NOT EXISTS "withholding_tax_minor" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "net_payout_minor" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "finance_mlm"."payout_documents" (
  "payout_document_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payout_line_id" UUID NOT NULL,
  "tutor_user_id" UUID NOT NULL,
  "document_number" TEXT NOT NULL,
  "document_type" TEXT NOT NULL,
  "gross_amount_minor" BIGINT NOT NULL,
  "withholding_tax_minor" BIGINT NOT NULL,
  "net_amount_minor" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payout_documents_pkey" PRIMARY KEY ("payout_document_id"),
  CONSTRAINT "payout_documents_payout_line_id_fkey" FOREIGN KEY ("payout_line_id")
    REFERENCES "finance_mlm"."payout_lines"("payout_line_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payout_documents_payout_line_id_key"
ON "finance_mlm"."payout_documents"("payout_line_id");

CREATE UNIQUE INDEX IF NOT EXISTS "payout_documents_document_number_key"
ON "finance_mlm"."payout_documents"("document_number");
