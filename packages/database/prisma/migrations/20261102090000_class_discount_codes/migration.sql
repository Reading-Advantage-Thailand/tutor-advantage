-- Class discount codes and admin-created classes (2026-11-02).
--  * discount_codes: admin-issued codes that waive a class's tuition. A code
--    belongs to one class; EXPIRED and USED_UP are derived from expires_at and
--    redeemed_count, so the stored status is only ACTIVE or VOID.
--  * discount_code_redemptions: one row per use. It points at the 0 THB
--    SUCCESS payment intent that activated the enrollment, so reconciliation
--    sees a normal successful payment. One use per student per code.
--  * classes.setup_required_at: set when an admin creates a class on a
--    tutor's behalf (the tutor may not have signed up yet); cleared when the
--    tutor completes the setup form.

-- AlterTable
ALTER TABLE "learning"."classes" ADD COLUMN "setup_required_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "finance_mlm"."discount_codes" (
    "discount_code_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "class_id" UUID NOT NULL,
    "max_redemptions" INTEGER NOT NULL DEFAULT 1,
    "redeemed_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "creation_idempotency_key" TEXT,
    "expires_at" TIMESTAMPTZ,
    "voided_at" TIMESTAMPTZ,
    "voided_by_user_id" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("discount_code_id"),
    -- Last line of defence against over-redemption under concurrency.
    CONSTRAINT "discount_codes_redemptions_within_limit" CHECK (
        "max_redemptions" >= 1
        AND "redeemed_count" >= 0
        AND "redeemed_count" <= "max_redemptions"
    ),
    CONSTRAINT "discount_codes_status_check" CHECK ("status" IN ('ACTIVE', 'VOID'))
);

-- CreateTable
CREATE TABLE "finance_mlm"."discount_code_redemptions" (
    "redemption_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "discount_code_id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "enrollment_package_id" UUID,
    "payment_intent_id" UUID NOT NULL,
    "original_amount_minor" BIGINT NOT NULL,
    "discount_amount_minor" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_code_redemptions_pkey" PRIMARY KEY ("redemption_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_key" ON "finance_mlm"."discount_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_creation_idempotency_key_key" ON "finance_mlm"."discount_codes"("creation_idempotency_key");

-- CreateIndex
CREATE INDEX "discount_codes_class_id_idx" ON "finance_mlm"."discount_codes"("class_id");

-- CreateIndex
CREATE INDEX "discount_codes_status_idx" ON "finance_mlm"."discount_codes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "discount_code_redemptions_payment_intent_id_key" ON "finance_mlm"."discount_code_redemptions"("payment_intent_id");

-- CreateIndex
CREATE INDEX "discount_code_redemptions_enrollment_id_idx" ON "finance_mlm"."discount_code_redemptions"("enrollment_id");

-- CreateIndex
CREATE INDEX "discount_code_redemptions_student_user_id_idx" ON "finance_mlm"."discount_code_redemptions"("student_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_code_redemptions_discount_code_id_student_user_id_key" ON "finance_mlm"."discount_code_redemptions"("discount_code_id", "student_user_id");

-- AddForeignKey
ALTER TABLE "finance_mlm"."discount_code_redemptions" ADD CONSTRAINT "discount_code_redemptions_discount_code_id_fkey" FOREIGN KEY ("discount_code_id") REFERENCES "finance_mlm"."discount_codes"("discount_code_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: deleting a payment intent (learning deleteClass removes a
-- demo class's payments) removes its redemption row with it.
ALTER TABLE "finance_mlm"."discount_code_redemptions" ADD CONSTRAINT "discount_code_redemptions_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "finance_mlm"."payment_intents"("payment_intent_id") ON DELETE CASCADE ON UPDATE CASCADE;
