-- AlterTable
ALTER TABLE "identity"."users" ADD COLUMN     "profile_picture_url" TEXT,
ADD COLUMN     "settings" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "learning"."classes" ADD COLUMN     "schedule_description" TEXT;

-- CreateTable
CREATE TABLE "learning"."articles" (
    "article_id" TEXT NOT NULL,
    "book_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "genre" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("article_id")
);

-- CreateTable
CREATE TABLE "learning"."unresolved_legacy_links" (
    "url" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "last_seen" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unresolved_legacy_links_pkey" PRIMARY KEY ("url")
);

-- CreateTable
CREATE TABLE "learning"."legacy_link_mappings" (
    "mapping_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_url" TEXT NOT NULL,
    "target_path" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_link_mappings_pkey" PRIMARY KEY ("mapping_id")
);

-- CreateTable
CREATE TABLE "learning"."conversations" (
    "conversation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "class_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("conversation_id")
);

-- CreateTable
CREATE TABLE "learning"."conversation_participants" (
    "participant_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMPTZ,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("participant_id")
);

-- CreateTable
CREATE TABLE "learning"."messages" (
    "message_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "learning"."class_transfer_requests" (
    "transfer_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "original_tutor_id" UUID NOT NULL,
    "new_tutor_id" UUID,
    "status" TEXT NOT NULL,
    "network_bonus_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "reason" TEXT,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_transfer_requests_pkey" PRIMARY KEY ("transfer_id")
);

-- CreateTable
CREATE TABLE "learning"."tutor_performances" (
    "performance_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_user_id" UUID NOT NULL,
    "period_month" TEXT NOT NULL,
    "avg_response_time_minutes" INTEGER,
    "student_score_avg" DECIMAL(5,2),
    "overall_rating" DECIMAL(3,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_performances_pkey" PRIMARY KEY ("performance_id")
);

-- CreateTable
CREATE TABLE "learning"."tutor_badges" (
    "badge_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_user_id" UUID NOT NULL,
    "badge_code" TEXT NOT NULL,
    "unlocked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_badges_pkey" PRIMARY KEY ("badge_id")
);

-- CreateTable
CREATE TABLE "finance_mlm"."exceptions" (
    "exception_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "student_user_id" UUID,
    "student_name" TEXT,
    "class_id" TEXT,
    "provider" TEXT,
    "amount_minor" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
    "error_detail" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exceptions_pkey" PRIMARY KEY ("exception_id")
);

-- CreateTable
CREATE TABLE "finance_mlm"."fraud_flags" (
    "flag_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_name" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INVESTIGATING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_flags_pkey" PRIMARY KEY ("flag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legacy_link_mappings_source_url_key" ON "learning"."legacy_link_mappings"("source_url");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "learning"."conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_performances_tutor_user_id_period_month_key" ON "learning"."tutor_performances"("tutor_user_id", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_badges_tutor_user_id_badge_code_key" ON "learning"."tutor_badges"("tutor_user_id", "badge_code");

-- AddForeignKey
ALTER TABLE "learning"."articles" ADD CONSTRAINT "articles_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "learning"."books"("book_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."conversations" ADD CONSTRAINT "conversations_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "learning"."conversations"("conversation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "learning"."conversations"("conversation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."class_transfer_requests" ADD CONSTRAINT "class_transfer_requests_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."tutor_performances" ADD CONSTRAINT "tutor_performances_tutor_user_id_fkey" FOREIGN KEY ("tutor_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."tutor_badges" ADD CONSTRAINT "tutor_badges_tutor_user_id_fkey" FOREIGN KEY ("tutor_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
