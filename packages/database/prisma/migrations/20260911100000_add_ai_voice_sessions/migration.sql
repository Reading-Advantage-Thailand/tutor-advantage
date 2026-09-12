CREATE TABLE "learning"."ai_voice_sessions" (
    "voice_session_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enrollment_package_id" UUID NOT NULL,
    "class_book_cycle_id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "article_id" TEXT NOT NULL,
    "provider_call_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reserved_seconds" INTEGER NOT NULL,
    "consumed_seconds" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "end_reason" TEXT,
    "summary" JSONB,
    "scores" JSONB,
    "provider_usage" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_voice_sessions_pkey" PRIMARY KEY ("voice_session_id")
);

CREATE TABLE "learning"."active_ai_voice_sessions" (
    "student_user_id" UUID NOT NULL,
    "voice_session_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "active_ai_voice_sessions_pkey" PRIMARY KEY ("student_user_id")
);

CREATE UNIQUE INDEX "active_ai_voice_sessions_voice_session_id_key" ON "learning"."active_ai_voice_sessions"("voice_session_id");
CREATE INDEX "ai_voice_sessions_enrollment_package_id_created_at_idx" ON "learning"."ai_voice_sessions"("enrollment_package_id", "created_at");
CREATE INDEX "ai_voice_sessions_class_book_cycle_id_student_user_id_created_at_idx" ON "learning"."ai_voice_sessions"("class_book_cycle_id", "student_user_id", "created_at");
CREATE INDEX "ai_voice_sessions_status_expires_at_idx" ON "learning"."ai_voice_sessions"("status", "expires_at");
CREATE INDEX "active_ai_voice_sessions_expires_at_idx" ON "learning"."active_ai_voice_sessions"("expires_at");

ALTER TABLE "learning"."ai_voice_sessions" ADD CONSTRAINT "ai_voice_sessions_enrollment_package_id_fkey" FOREIGN KEY ("enrollment_package_id") REFERENCES "learning"."enrollment_packages"("enrollment_package_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning"."ai_voice_sessions" ADD CONSTRAINT "ai_voice_sessions_class_book_cycle_id_fkey" FOREIGN KEY ("class_book_cycle_id") REFERENCES "learning"."class_book_cycles"("class_book_cycle_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning"."ai_voice_sessions" ADD CONSTRAINT "ai_voice_sessions_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "identity"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning"."active_ai_voice_sessions" ADD CONSTRAINT "active_ai_voice_sessions_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "identity"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning"."active_ai_voice_sessions" ADD CONSTRAINT "active_ai_voice_sessions_voice_session_id_fkey" FOREIGN KEY ("voice_session_id") REFERENCES "learning"."ai_voice_sessions"("voice_session_id") ON DELETE CASCADE ON UPDATE CASCADE;
