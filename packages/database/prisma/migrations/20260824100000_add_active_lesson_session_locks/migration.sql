CREATE TABLE IF NOT EXISTS "learning"."active_lesson_session_locks" (
    "class_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "tutor_user_id" UUID NOT NULL,
    "last_heartbeat_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_lesson_session_locks_pkey" PRIMARY KEY ("class_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "active_lesson_session_locks_session_id_key"
    ON "learning"."active_lesson_session_locks"("session_id");

CREATE INDEX IF NOT EXISTS "active_lesson_session_locks_tutor_user_id_idx"
    ON "learning"."active_lesson_session_locks"("tutor_user_id");

ALTER TABLE "learning"."active_lesson_session_locks"
    ADD CONSTRAINT "active_lesson_session_locks_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning"."active_lesson_session_locks"
    ADD CONSTRAINT "active_lesson_session_locks_tutor_user_id_fkey"
    FOREIGN KEY ("tutor_user_id") REFERENCES "identity"."users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
