-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finance_mlm";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "identity";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "learning";

-- CreateTable
CREATE TABLE "identity"."users" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" TEXT NOT NULL,
    "display_name" TEXT,
    "email" TEXT,
    "phone_number" TEXT,
    "date_of_birth" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sponsor_tutor_id" UUID,
    "sponsor_locked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "identity"."oauth_identities" (
    "identity_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_subject" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("identity_id")
);

-- CreateTable
CREATE TABLE "identity"."guardian_consents" (
    "consent_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_user_id" UUID NOT NULL,
    "guardian_user_id" UUID,
    "guardian_name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "consented_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_consents_pkey" PRIMARY KEY ("consent_id")
);

-- CreateTable
CREATE TABLE "identity"."user_consents" (
    "user_consent_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "consent_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effective_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("user_consent_id")
);

-- CreateTable
CREATE TABLE "learning"."series" (
    "series_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cefr_level" TEXT NOT NULL,
    "ra_level_start" INTEGER NOT NULL,
    "ra_level_end" INTEGER NOT NULL,
    "tagline" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_pkey" PRIMARY KEY ("series_id")
);

-- CreateTable
CREATE TABLE "learning"."books" (
    "book_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "series_id" UUID NOT NULL,
    "level_number" INTEGER NOT NULL,
    "book_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "article_count" INTEGER NOT NULL,
    "class_hours" INTEGER,
    "independent_hours" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "books_pkey" PRIMARY KEY ("book_id")
);

-- CreateTable
CREATE TABLE "learning"."classes" (
    "class_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "enrolled_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("class_id")
);

-- CreateTable
CREATE TABLE "learning"."referrals" (
    "referral_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "class_id" UUID NOT NULL,
    "tutor_user_id" UUID NOT NULL,
    "campaign_label" TEXT,
    "status" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("referral_id")
);

-- CreateTable
CREATE TABLE "learning"."enrollments" (
    "enrollment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "referral_token" TEXT,
    "status" TEXT NOT NULL,
    "payment_transaction_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("enrollment_id")
);

-- CreateTable
CREATE TABLE "finance_mlm"."payment_intents" (
    "payment_intent_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enrollment_id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "provider_ref" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("payment_intent_id")
);

-- CreateTable
CREATE TABLE "finance_mlm"."payment_events" (
    "payment_event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_intent_id" UUID,
    "event_type" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("payment_event_id")
);

-- CreateTable
CREATE TABLE "finance_mlm"."settlement_runs" (
    "settlement_run_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "period_month" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "status" TEXT NOT NULL,
    "preview_payload" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" TEXT,
    "approved_at" TIMESTAMPTZ,

    CONSTRAINT "settlement_runs_pkey" PRIMARY KEY ("settlement_run_id")
);

-- CreateTable
CREATE TABLE "finance_mlm"."payout_lines" (
    "payout_line_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "settlement_run_id" UUID NOT NULL,
    "tutor_user_id" UUID NOT NULL,
    "gross_volume_minor" BIGINT NOT NULL,
    "payout_rate" DECIMAL(12,8) NOT NULL,
    "payout_amount_minor" BIGINT NOT NULL,
    "eligibility_status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_lines_pkey" PRIMARY KEY ("payout_line_id")
);

-- CreateTable
CREATE TABLE "finance_mlm"."adjustments" (
    "adjustment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "settlement_run_id" UUID NOT NULL,
    "tutor_user_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjustments_pkey" PRIMARY KEY ("adjustment_id")
);

-- CreateTable
CREATE TABLE "finance_mlm"."audit_events" (
    "audit_event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("audit_event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "identity"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_identities_provider_provider_subject_key" ON "identity"."oauth_identities"("provider", "provider_subject");

-- CreateIndex
CREATE UNIQUE INDEX "series_code_key" ON "learning"."series"("code");

-- CreateIndex
CREATE UNIQUE INDEX "books_book_code_key" ON "learning"."books"("book_code");

-- CreateIndex
CREATE INDEX "classes_tutor_user_id_status_idx" ON "learning"."classes"("tutor_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_token_key" ON "learning"."referrals"("token");

-- CreateIndex
CREATE INDEX "enrollments_student_user_id_status_idx" ON "learning"."enrollments"("student_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_idempotency_key_key" ON "finance_mlm"."payment_intents"("idempotency_key");

-- CreateIndex
CREATE INDEX "settlement_runs_period_month_status_idx" ON "finance_mlm"."settlement_runs"("period_month", "status");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_created_at_idx" ON "finance_mlm"."audit_events"("entity_type", "entity_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "identity"."oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."guardian_consents" ADD CONSTRAINT "guardian_consents_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."guardian_consents" ADD CONSTRAINT "guardian_consents_guardian_user_id_fkey" FOREIGN KEY ("guardian_user_id") REFERENCES "identity"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."books" ADD CONSTRAINT "books_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "learning"."series"("series_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."classes" ADD CONSTRAINT "classes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "learning"."books"("book_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."referrals" ADD CONSTRAINT "referrals_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."enrollments" ADD CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_mlm"."payment_events" ADD CONSTRAINT "payment_events_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "finance_mlm"."payment_intents"("payment_intent_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_mlm"."payout_lines" ADD CONSTRAINT "payout_lines_settlement_run_id_fkey" FOREIGN KEY ("settlement_run_id") REFERENCES "finance_mlm"."settlement_runs"("settlement_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_mlm"."adjustments" ADD CONSTRAINT "adjustments_settlement_run_id_fkey" FOREIGN KEY ("settlement_run_id") REFERENCES "finance_mlm"."settlement_runs"("settlement_run_id") ON DELETE RESTRICT ON UPDATE CASCADE;
