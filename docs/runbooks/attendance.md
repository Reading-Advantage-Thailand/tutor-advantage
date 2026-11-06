# Attendance records (บันทึกการเข้าเรียน) — operator runbook

Tutors mark each class meeting as มาเรียน / มาสาย / ขาดเรียน. Students see their
own history, and admins get a read-only view. Rules live in
`services/learning-service/src/services/attendance.ts`.

Code: `services/learning-service` (`/v1/classes/:classId/attendance…`,
`/v1/admin/classes/:classId/attendance`), migration
`20261106090000_attendance_records`.

## Tables

| Table | Holds | Keys |
|---|---|---|
| `learning.class_meetings` | One meeting with at least one mark: Bangkok date, start, end, `SCHEDULED` or `ADHOC`. | Unique `(class_id, meeting_date, start_time)`. Deleted with its class. |
| `learning.attendance_records` | One student's `PRESENT`, `LATE` or `ABSENT` on a meeting. No row means not marked. | Unique `(meeting_id, student_user_id)`. Tied to the student, not the enrollment. |

A meeting row appears on the first saved mark and is deleted when its last mark
is removed. Its date and times are a snapshot and do not change when the
schedule does.

## Rules

- **Who.** Only the class's current tutor can mark or see the roster. A student
  sees only their own marks, for any enrollment status. Admins read only.
- **When.** A meeting can be marked once it has started, by server Bangkok time.
  Closed classes stay markable, and there is no edit deadline.
- **Not available.** Demo classes and classes waiting for tutor setup answer
  `ATTENDANCE_NOT_AVAILABLE`.
- **Roster.** Students with an `ACTIVE` enrollment, plus anyone already marked on
  that meeting. A mark can be changed only while the student is `ACTIVE`;
  otherwise the whole save fails with `STUDENT_NOT_ENROLLED`.
- **Joined later.** An active student whose earliest enrollment `created_at`, as
  a Bangkok date, is after the meeting date is not expected there. They are left
  out of `unmarked` and "มาครบทุกคน", and stay on the roster so the tutor can still
  mark them by hand. A same-day enrollment is expected.
- **Old meetings.** Whether a date is in the schedule does not depend on today.
  The list shows unmarked legacy weekly meetings from the last 120 days only, but
  an older weekly date stays in the schedule: its saved rows keep their place, and
  it can be marked from a direct link, as dated entries can.
- **Moved time.** If a date has one schedule entry and one scheduled meeting row
  at a different time, they are one meeting. The list shows the new time with
  `movedFrom`, and saves go to the existing row. Ad hoc rows never merge.
- **Make-up meetings.** The tutor gives a date and time outside the schedule. It
  must have started and be no more than 120 days old.
- **Rate.** `(present + late) / marked`. Unmarked meetings and students are left
  out, and the rate is empty when nothing is marked.
- **Join hint.** The earliest live-lesson join in the window from 30 minutes
  before start to the end (or start + 3 hours). It is only shown to the tutor and
  never creates a mark. A missing hint does not mean absent, because tutors may
  teach by meeting link.

## Audit

A save that changes or removes an existing mark writes one `ATTENDANCE_CORRECT`
row to `finance_mlm.audit_events`. `entity_type` is `CLASS_MEETING`, `entity_id`
is the meeting id, and the payload holds counts only. First-time marks write no
audit row. Each record keeps only its latest `marked_by_user_id` and `marked_at`,
so earlier values are not recoverable. After a meeting's last mark is removed,
its audit row points at a deleted meeting.

## What it does not do

- No parent or guardian reports or notifications, and no LINE messages.
- No effect on money, hours, settlement or reminders.
- No backfill of past lessons.
- No cancelled-meeting status and no make-up policy. A lesson that did not happen
  is left unmarked, not marked absent. It still appears in the tutor's list and is
  excluded from rates.
- No corrections by admins. Ask the tutor to correct the mark.

## Backup and recovery

Both tables are in the gap-row list in `backup-and-recovery.md` (step A9).
