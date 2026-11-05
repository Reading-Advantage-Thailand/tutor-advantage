-- Support tickets (2026-11-05).
--  * support_tickets: one help-desk request from a student or tutor, answered
--    by admins in the admin console. ticket_number is the human reference
--    (#123). due_at is the first-response deadline (end of the 2nd Bangkok
--    business day after creation, 3rd for REFUND), set by learning-service.
--    awaiting_support drives the admin badge: true while the next move is the
--    support team's. (requester_user_id, idempotency_key) is unique so a
--    retried create returns the first ticket instead of a duplicate.
--  * support_ticket_messages: the thread. INTERNAL_NOTE rows are support-only
--    (CHECK) and never shown to the requester; STATUS_CHANGE rows record
--    from_status -> to_status. (ticket_id, client_message_id) is unique so a
--    retried reply is not posted twice.
--  * Both tables are new; nothing reads them before this release, so the
--    migration is safe to apply ahead of the code.

-- CreateTable
CREATE TABLE "learning"."support_tickets" (
    "ticket_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_number" SERIAL NOT NULL,
    "requester_user_id" UUID NOT NULL,
    "requester_role" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "awaiting_support" BOOLEAN NOT NULL,
    "class_id" UUID,
    "payment_reference" TEXT,
    "assignee_user_id" UUID,
    "idempotency_key" TEXT,
    "due_at" TIMESTAMPTZ NOT NULL,
    "first_response_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "requester_last_read_at" TIMESTAMPTZ,
    "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("ticket_id"),
    CONSTRAINT "support_tickets_requester_role_check" CHECK ("requester_role" IN ('STUDENT', 'TUTOR')),
    CONSTRAINT "support_tickets_category_check" CHECK ("category" IN ('REFUND', 'BOOK_DELIVERY', 'BOOK_DAMAGED', 'CLASS', 'PAYOUT', 'PRIVACY', 'TECHNICAL', 'OTHER')),
    CONSTRAINT "support_tickets_status_check" CHECK ("status" IN ('OPEN', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'RESOLVED')),
    CONSTRAINT "support_tickets_subject_check" CHECK (char_length("subject") BETWEEN 3 AND 120),
    CONSTRAINT "support_tickets_payment_reference_check" CHECK ("payment_reference" IS NULL OR "payment_reference" ~ '^[A-Za-z0-9_-]{1,64}$'),
    CONSTRAINT "support_tickets_resolved_at_check" CHECK ("status" = 'RESOLVED' OR "resolved_at" IS NULL)
);

-- CreateTable
CREATE TABLE "learning"."support_ticket_messages" (
    "message_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "author_side" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT,
    "from_status" TEXT,
    "to_status" TEXT,
    "client_message_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("message_id"),
    CONSTRAINT "support_ticket_messages_author_side_check" CHECK ("author_side" IN ('REQUESTER', 'SUPPORT')),
    CONSTRAINT "support_ticket_messages_kind_check" CHECK ("kind" IN ('MESSAGE', 'INTERNAL_NOTE', 'STATUS_CHANGE')),
    CONSTRAINT "support_ticket_messages_internal_note_check" CHECK ("kind" <> 'INTERNAL_NOTE' OR "author_side" = 'SUPPORT'),
    CONSTRAINT "support_ticket_messages_body_check" CHECK (
        ("kind" = 'STATUS_CHANGE' AND "to_status" IS NOT NULL)
        OR ("kind" IN ('MESSAGE', 'INTERNAL_NOTE') AND "body" IS NOT NULL AND char_length("body") BETWEEN 1 AND 4000)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "learning"."support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_status_due_at_idx" ON "learning"."support_tickets"("status", "due_at");

-- CreateIndex
CREATE INDEX "support_tickets_requester_user_id_last_message_at_idx" ON "learning"."support_tickets"("requester_user_id", "last_message_at");

-- CreateIndex
CREATE INDEX "support_tickets_awaiting_support_idx" ON "learning"."support_tickets"("awaiting_support");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_requester_user_id_idempotency_key_key" ON "learning"."support_tickets"("requester_user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "support_ticket_messages_ticket_id_created_at_idx" ON "learning"."support_ticket_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_ticket_messages_ticket_id_client_message_id_key" ON "learning"."support_ticket_messages"("ticket_id", "client_message_id");

-- AddForeignKey
ALTER TABLE "learning"."support_tickets" ADD CONSTRAINT "support_tickets_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."support_tickets" ADD CONSTRAINT "support_tickets_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "identity"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."support_tickets" ADD CONSTRAINT "support_tickets_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "learning"."support_tickets"("ticket_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
