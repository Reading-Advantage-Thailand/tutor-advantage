-- PostgreSQL truncated the 68-character index name from
-- 20260911100000_add_ai_voice_sessions to 63 characters. Use the name Prisma
-- derives for the same index so migrate diff reports no drift.
ALTER INDEX "learning"."ai_voice_sessions_class_book_cycle_id_student_user_id_created_a"
  RENAME TO "ai_voice_sessions_class_book_cycle_id_student_user_id_creat_idx";
