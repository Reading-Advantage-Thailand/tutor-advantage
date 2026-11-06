/**
 * Pure model of the read-only class attendance page (/classes/[id]/attendance).
 * Admins only look: marking belongs to the class's tutor.
 */
import { formatThaiDate } from "@/lib/format";

export type MeetingSource = "SCHEDULED" | "ADHOC";

export interface AttendanceMeetingSummary {
  /** yyyy-MM-dd, Bangkok */
  date: string;
  /** HH:mm */
  start: string;
  end: string | null;
  source: MeetingSource;
  inSchedule: boolean;
  /** HH:mm of the saved row when the schedule moved this meeting. */
  movedFrom: string | null;
  counts: { present: number; late: number; absent: number; unmarked: number };
  marked: boolean;
}

export interface AttendanceStudentStats {
  studentUserId: string;
  name: string | null;
  avatarUrl: string | null;
  present: number;
  late: number;
  absent: number;
  /** 0..1, null when nothing is marked */
  rate: number | null;
}

export interface AdminClassAttendanceResponse {
  class: { classId: string; title: string; tutorName: string | null };
  meetings: AttendanceMeetingSummary[];
  students: AttendanceStudentStats[];
}

export function classAttendanceKey(adminId: string, classId: string): string {
  return `${adminId}:classes:attendance:${classId}`;
}

export function classAttendancePath(classId: string): string {
  return `/v1/admin/classes/${encodeURIComponent(classId)}/attendance`;
}

export function classAttendanceHref(classId: string): string {
  return `/classes/${encodeURIComponent(classId)}/attendance`;
}

export function studentProfileHref(studentUserId: string): string {
  return `/users/${encodeURIComponent(studentUserId)}`;
}

/** Date + start identify a meeting within one class. */
export function meetingRowKey(meeting: Pick<AttendanceMeetingSummary, "date" | "start">): string {
  return `${meeting.date}|${meeting.start}`;
}

/** The date is a Bangkok calendar day: anchor it there so no viewer's timezone can shift it. */
export function meetingDateLabel(date: string): string {
  return formatThaiDate(`${date}T00:00:00+07:00`) || date;
}

export function meetingTimeLabel(meeting: Pick<AttendanceMeetingSummary, "start" | "end">): string {
  return meeting.end ? `${meeting.start}–${meeting.end}` : meeting.start;
}

export type MeetingNote = { kind: "adhoc" } | { kind: "offSchedule" } | { kind: "moved"; from: string };

/** Why a meeting differs from the current schedule, if it does. */
export function meetingNote(meeting: Pick<AttendanceMeetingSummary, "source" | "inSchedule" | "movedFrom">): MeetingNote | null {
  if (meeting.source === "ADHOC") return { kind: "adhoc" };
  if (meeting.movedFrom) return { kind: "moved", from: meeting.movedFrom };
  return meeting.inSchedule ? null : { kind: "offSchedule" };
}

export type MeetingProgress = "none" | "partial" | "complete";

export function meetingProgress(meeting: Pick<AttendanceMeetingSummary, "marked" | "counts">): MeetingProgress {
  if (!meeting.marked) return "none";
  return meeting.counts.unmarked > 0 ? "partial" : "complete";
}

export type AttendanceLoadFailure = "notFound" | "notAvailable" | "retry";

/**
 * 404/400: no such class. ATTENDANCE_NOT_AVAILABLE: demo or setup-pending class,
 * which the list can link to while setup is pending, so it is a state and not an error.
 */
export function attendanceLoadFailure(error: unknown): AttendanceLoadFailure {
  const { status, code } = (error ?? {}) as { status?: unknown; code?: unknown };
  if (status === 404 || status === 400) return "notFound";
  if (status === 409 && code === "ATTENDANCE_NOT_AVAILABLE") return "notAvailable";
  return "retry";
}
