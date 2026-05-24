CREATE INDEX IF NOT EXISTS "articles_book_id_idx"
  ON "learning"."articles" ("book_id");

CREATE INDEX IF NOT EXISTS "session_participants_student_joined_idx"
  ON "learning"."session_participants" ("student_user_id", "joined_at");

CREATE INDEX IF NOT EXISTS "conversation_participants_user_id_idx"
  ON "learning"."conversation_participants" ("user_id");

CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx"
  ON "learning"."messages" ("conversation_id", "created_at");
