-- CreateTable
CREATE TABLE "learning"."interactive_sessions" (
    "session_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID,
    "tutor_user_id" UUID NOT NULL,
    "article_id" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactive_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "learning"."session_participants" (
    "participant_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("participant_id")
);

-- CreateTable
CREATE TABLE "learning"."session_answers" (
    "answer_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "phase" INTEGER NOT NULL,
    "question_id" TEXT,
    "question_text" TEXT,
    "answer_text" TEXT,
    "correct_answer" TEXT,
    "options" JSONB,
    "is_correct" BOOLEAN,
    "score" INTEGER NOT NULL DEFAULT 0,
    "ai_feedback" TEXT,
    "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_answers_pkey" PRIMARY KEY ("answer_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_session_id_student_user_id_key" ON "learning"."session_participants"("session_id", "student_user_id");

-- AddForeignKey
ALTER TABLE "learning"."interactive_sessions" ADD CONSTRAINT "interactive_sessions_tutor_user_id_fkey" FOREIGN KEY ("tutor_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."session_participants" ADD CONSTRAINT "session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning"."interactive_sessions"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."session_participants" ADD CONSTRAINT "session_participants_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."session_answers" ADD CONSTRAINT "session_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning"."interactive_sessions"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."session_answers" ADD CONSTRAINT "session_answers_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
