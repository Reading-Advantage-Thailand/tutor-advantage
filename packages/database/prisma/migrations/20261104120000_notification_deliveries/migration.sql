-- Scheduled LINE reminders (2026-11-04).
--  * notification_deliveries: one row per reminder the learning service's
--    Cloud Scheduler jobs send (class starts in 15 minutes, unpaid book
--    follow-ups). dedup_key is unique, so a retried or overlapping run cannot
--    send the same reminder twice; delivery_id is reused as LINE's
--    X-Line-Retry-Key when a FAILED row is retried.

-- CreateTable
CREATE TABLE "learning"."notification_deliveries" (
    "delivery_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dedup_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "class_id" UUID,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("delivery_id"),
    CONSTRAINT "notification_deliveries_kind_check" CHECK ("kind" IN ('CLASS_SESSION_REMINDER', 'BOOK_PAYMENT_REMINDER')),
    CONSTRAINT "notification_deliveries_status_check" CHECK ("status" IN ('CLAIMED', 'SENT', 'SKIPPED', 'FAILED'))
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_dedup_key_key" ON "learning"."notification_deliveries"("dedup_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_updated_at_idx" ON "learning"."notification_deliveries"("status", "updated_at");
