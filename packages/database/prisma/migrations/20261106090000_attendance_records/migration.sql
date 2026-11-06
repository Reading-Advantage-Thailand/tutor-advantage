-- Attendance records (2026-11-06).
--  * class_meetings: one dated class meeting with at least one mark. Created on
--    the first saved mark and deleted with its last mark. meeting_date,
--    start_time and end_time are a Bangkok wall-clock snapshot, never joined
--    back to classes.schedule_data, so the row survives a reschedule.
--    (class_id, meeting_date, start_time) is unique. class_id cascades because
--    deleteClass relies on it.
--  * attendance_records: one student's PRESENT/LATE/ABSENT mark for a meeting.
--    (meeting_id, student_user_id) is unique. No row means "not marked". Keyed
--    on the student, never the enrollment, so marks outlive re-enrollment.
--  * interactive_sessions (class_id, created_at) index: the join hint looks up
--    a class's sessions, which would otherwise scan the table.
--  * Both tables are new; nothing reads them before this release, so the
--    migration is safe to apply ahead of the code. The index takes a brief write
--    lock on interactive_sessions, which only live lessons write to.

-- CreateTable
CREATE TABLE "learning"."class_meetings" (
    "meeting_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "meeting_date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT,
    "source" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_meetings_pkey" PRIMARY KEY ("meeting_id"),
    CONSTRAINT "class_meetings_meeting_date_check" CHECK ("meeting_date" ~ '^\d{4}-\d{2}-\d{2}$'),
    CONSTRAINT "class_meetings_start_time_check" CHECK ("start_time" ~ '^([01]\d|2[0-3]):[0-5]\d$'),
    CONSTRAINT "class_meetings_end_time_check" CHECK ("end_time" IS NULL OR ("end_time" ~ '^([01]\d|2[0-3]):[0-5]\d$' AND "start_time" < "end_time")),
    CONSTRAINT "class_meetings_source_check" CHECK ("source" IN ('SCHEDULED', 'ADHOC'))
);

-- CreateTable
CREATE TABLE "learning"."attendance_records" (
    "record_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "marked_by_user_id" UUID NOT NULL,
    "marked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("record_id"),
    CONSTRAINT "attendance_records_status_check" CHECK ("status" IN ('PRESENT', 'LATE', 'ABSENT'))
);

-- CreateIndex
CREATE INDEX "class_meetings_class_id_meeting_date_idx" ON "learning"."class_meetings"("class_id", "meeting_date");

-- CreateIndex
CREATE UNIQUE INDEX "class_meetings_class_id_meeting_date_start_time_key" ON "learning"."class_meetings"("class_id", "meeting_date", "start_time");

-- CreateIndex
CREATE INDEX "attendance_records_student_user_id_idx" ON "learning"."attendance_records"("student_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_meeting_id_student_user_id_key" ON "learning"."attendance_records"("meeting_id", "student_user_id");

-- CreateIndex
CREATE INDEX "interactive_sessions_class_id_created_at_idx" ON "learning"."interactive_sessions"("class_id", "created_at");

-- AddForeignKey
ALTER TABLE "learning"."class_meetings" ADD CONSTRAINT "class_meetings_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."class_meetings" ADD CONSTRAINT "class_meetings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."attendance_records" ADD CONSTRAINT "attendance_records_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "learning"."class_meetings"("meeting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."attendance_records" ADD CONSTRAINT "attendance_records_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."attendance_records" ADD CONSTRAINT "attendance_records_marked_by_user_id_fkey" FOREIGN KEY ("marked_by_user_id") REFERENCES "identity"."users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
