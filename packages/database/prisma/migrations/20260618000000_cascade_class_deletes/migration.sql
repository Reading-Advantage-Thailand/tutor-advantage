-- DropForeignKey
ALTER TABLE "learning"."class_book_cycles" DROP CONSTRAINT "class_book_cycles_class_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."class_transfer_requests" DROP CONSTRAINT "class_transfer_requests_class_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."conversation_participants" DROP CONSTRAINT "conversation_participants_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."conversations" DROP CONSTRAINT "conversations_class_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."messages" DROP CONSTRAINT "messages_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."referrals" DROP CONSTRAINT "referrals_class_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."session_answers" DROP CONSTRAINT "session_answers_session_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."session_participants" DROP CONSTRAINT "session_participants_session_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."tutor_reviews" DROP CONSTRAINT "tutor_reviews_class_id_fkey";

-- Delete orphans
DELETE FROM "learning"."session_answers" WHERE "session_id" IN (
    SELECT "session_id" FROM "learning"."interactive_sessions" WHERE "class_id" IS NOT NULL AND "class_id" NOT IN (SELECT "class_id" FROM "learning"."classes")
);
DELETE FROM "learning"."session_participants" WHERE "session_id" IN (
    SELECT "session_id" FROM "learning"."interactive_sessions" WHERE "class_id" IS NOT NULL AND "class_id" NOT IN (SELECT "class_id" FROM "learning"."classes")
);
DELETE FROM "learning"."interactive_sessions" WHERE "class_id" IS NOT NULL AND "class_id" NOT IN (SELECT "class_id" FROM "learning"."classes");

DELETE FROM "learning"."class_book_cycles" WHERE "class_id" NOT IN (SELECT "class_id" FROM "learning"."classes");
DELETE FROM "learning"."referrals" WHERE "class_id" NOT IN (SELECT "class_id" FROM "learning"."classes");
DELETE FROM "learning"."conversation_participants" WHERE "conversation_id" IN (
    SELECT "conversation_id" FROM "learning"."conversations" WHERE "class_id" IS NOT NULL AND "class_id" NOT IN (SELECT "class_id" FROM "learning"."classes")
);
DELETE FROM "learning"."messages" WHERE "conversation_id" IN (
    SELECT "conversation_id" FROM "learning"."conversations" WHERE "class_id" IS NOT NULL AND "class_id" NOT IN (SELECT "class_id" FROM "learning"."classes")
);
DELETE FROM "learning"."conversations" WHERE "class_id" IS NOT NULL AND "class_id" NOT IN (SELECT "class_id" FROM "learning"."classes");
DELETE FROM "learning"."class_transfer_requests" WHERE "class_id" NOT IN (SELECT "class_id" FROM "learning"."classes");
DELETE FROM "learning"."tutor_reviews" WHERE "class_id" NOT IN (SELECT "class_id" FROM "learning"."classes");

-- AddForeignKey
ALTER TABLE "learning"."class_book_cycles" ADD CONSTRAINT "class_book_cycles_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."referrals" ADD CONSTRAINT "referrals_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."interactive_sessions" ADD CONSTRAINT "interactive_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."session_participants" ADD CONSTRAINT "session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning"."interactive_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."session_answers" ADD CONSTRAINT "session_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning"."interactive_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."conversations" ADD CONSTRAINT "conversations_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "learning"."conversations"("conversation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "learning"."conversations"("conversation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."class_transfer_requests" ADD CONSTRAINT "class_transfer_requests_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."tutor_reviews" ADD CONSTRAINT "tutor_reviews_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;
