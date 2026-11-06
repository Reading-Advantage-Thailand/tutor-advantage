import { NBSP, formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";

/* Pure rules of the tutor attendance pages. Shapes mirror GET/PUT /v1/classes/:classId/attendance*. */

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT";
export type MeetingSource = "SCHEDULED" | "ADHOC";

export type MeetingCounts = { present: number; late: number; absent: number; unmarked: number };

export type MeetingSummary = {
  date: string;
  start: string;
  end: string | null;
  source: MeetingSource;
  inSchedule: boolean;
  movedFrom: string | null;
  counts: MeetingCounts;
  marked: boolean;
};

export type StudentStats = {
  studentUserId: string;
  name: string | null;
  avatarUrl: string | null;
  present: number;
  late: number;
  absent: number;
  rate: number | null;
};

export type AttendanceOverview = { meetings: MeetingSummary[]; students: StudentStats[] };

export type MeetingDetail = {
  date: string;
  start: string;
  end: string | null;
  source: MeetingSource;
  inSchedule: boolean;
  movedFrom: string | null;
  markable: boolean;
};

export type RosterRow = {
  studentUserId: string;
  name: string | null;
  avatarUrl: string | null;
  status: AttendanceStatus | null;
  joinedAt: string | null;
  enrolled: boolean;
  /** Enrolled after this meeting's date: can be marked, but is not expected. */
  joinedLater: boolean;
};

export type AttendanceMeetingData = { meeting: MeetingDetail; roster: RosterRow[] };

export type SaveAttendanceBody = {
  date: string;
  start: string;
  end?: string | null;
  marks: { studentUserId: string; status: AttendanceStatus | null }[];
};

/** Unsaved edits only: student id → the status it will become. Students left out keep their saved status. */
export type MarkChanges = Record<string, AttendanceStatus | null>;

const ADHOC_LOOKBACK_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ─── Validation ─────────────────────────────────────────────────────── */

export function isMeetingDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

export function isMeetingTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

function bangkokInstant(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+07:00`);
}

/** Bangkok calendar day of an instant, as yyyy-MM-dd. */
export function toBangkokDateKey(now: Date): string {
  return new Date(now.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Query of the mark page, or null when date/start are unusable. A bad `end` is only dropped: it is optional. */
export function parseMeetingParams(params: {
  date?: string | string[];
  start?: string | string[];
  end?: string | string[];
}): { date: string; start: string; end: string | null } | null {
  const { date, start, end } = params;
  if (!isMeetingDate(date) || !isMeetingTime(start)) return null;
  return { date, start, end: isMeetingTime(end) && end > start ? end : null };
}

export type AdhocField = "date" | "start" | "end";
export type AdhocErrors = Partial<Record<AdhocField, string>>;

/** Client-side check of the make-up form. The server decides again when the marks are saved. */
export function validateAdhocMeeting(input: { date: string; start: string; end: string }, now: Date): AdhocErrors {
  const errors: AdhocErrors = {};
  if (!isMeetingDate(input.date)) {
    errors.date = t("tutorClass.attendance.adhocDateInvalid");
  } else if (bangkokInstant(input.date, "00:00") < bangkokInstant(toBangkokDateKey(now), "00:00") - ADHOC_LOOKBACK_DAYS * DAY_MS) {
    errors.date = t("tutorClass.attendance.adhocDateTooOld");
  }
  if (!isMeetingTime(input.start)) {
    errors.start = t("tutorClass.attendance.adhocStartInvalid");
  } else if (!errors.date && bangkokInstant(input.date, input.start) > now.getTime()) {
    errors.start = t("tutorClass.attendance.errorNotStarted");
  }
  if (input.end && (!isMeetingTime(input.end) || (isMeetingTime(input.start) && input.end <= input.start))) {
    errors.end = t("tutorClass.attendance.adhocEndInvalid");
  }
  return errors;
}

/**
 * Why the mark page is read-only, or null when marks can be saved. Follows the
 * server's rule: only a meeting outside the schedule and past the window is too
 * old. Anything else the server refuses has not started, whatever the device clock says.
 */
export function meetingBlockReason(meeting: MeetingDetail, now: Date): "notStarted" | "tooOld" | null {
  if (meeting.markable) return null;
  const oldestAllowed = bangkokInstant(toBangkokDateKey(now), "00:00") - ADHOC_LOOKBACK_DAYS * DAY_MS;
  return !meeting.inSchedule && bangkokInstant(meeting.date, "00:00") < oldestAllowed ? "tooOld" : "notStarted";
}

/* ─── Routes ─────────────────────────────────────────────────────────── */

export function classStudentsHref(classId: string): string {
  return `/dashboard/classes/${classId}?tab=students`;
}

export function attendanceHistoryHref(classId: string): string {
  return `/dashboard/classes/${classId}/attendance`;
}

export function attendanceMeetingHref(classId: string, meeting: { date: string; start: string; end?: string | null }): string {
  const query = new URLSearchParams({ date: meeting.date, start: meeting.start });
  if (meeting.end) query.set("end", meeting.end);
  return `${attendanceHistoryHref(classId)}/meeting?${query.toString()}`;
}

/* ─── Labels ─────────────────────────────────────────────────────────── */

export function meetingDateLabel(date: string): string {
  return formatThaiDate(date);
}

export function meetingTimeLabel(start: string, end: string | null): string {
  return `${end ? `${start}–${end}` : start}${NBSP}น.`;
}

export function countsLabel(counts: MeetingCounts): string {
  const parts = [
    `${t("tutorClass.attendance.presentShort")} ${counts.present}`,
    `${t("tutorClass.attendance.lateShort")} ${counts.late}`,
    `${t("tutorClass.attendance.absentShort")} ${counts.absent}`,
  ];
  if (counts.unmarked > 0) parts.push(`${t("tutorClass.attendance.unmarked")} ${counts.unmarked}`);
  return parts.join(" · ");
}

export function statusLabel(status: AttendanceStatus): string {
  if (status === "PRESENT") return t("tutorClass.attendance.present");
  if (status === "LATE") return t("tutorClass.attendance.late");
  return t("tutorClass.attendance.absent");
}

export function statusTone(status: AttendanceStatus): "success" | "warning" | "danger" {
  if (status === "PRESENT") return "success";
  if (status === "LATE") return "warning";
  return "danger";
}

export type MeetingProgress = "unmarked" | "partial" | "complete";

export function meetingProgress(meeting: MeetingSummary): MeetingProgress {
  if (!meeting.marked) return "unmarked";
  return meeting.counts.unmarked > 0 ? "partial" : "complete";
}

/** A chip row is needed only when the meeting differs from an ordinary scheduled one. */
export function hasMeetingChips(meeting: { source: MeetingSource; inSchedule: boolean; movedFrom: string | null }): boolean {
  return meeting.source === "ADHOC" || meeting.movedFrom !== null || !meeting.inSchedule;
}

/** The newest meeting nobody has been marked on yet, skipping meetings with no students to mark. */
export function latestUnmarkedMeeting(meetings: MeetingSummary[]): MeetingSummary | null {
  return meetings.find((meeting) => !meeting.marked && meeting.counts.unmarked > 0) ?? null;
}

/* ─── Marking ────────────────────────────────────────────────────────── */

export function effectiveStatus(row: RosterRow, changes: MarkChanges): AttendanceStatus | null {
  return row.studentUserId in changes ? changes[row.studentUserId] : row.status;
}

function withMark(row: RosterRow, changes: MarkChanges, status: AttendanceStatus | null): MarkChanges {
  const next = { ...changes };
  if (status === row.status) delete next[row.studentUserId];
  else next[row.studentUserId] = status;
  return next;
}

/** Tap a status: selects it, or clears the mark when it is already selected. Read-only rows never change. */
export function toggleMark(roster: RosterRow[], changes: MarkChanges, studentUserId: string, status: AttendanceStatus): MarkChanges {
  const row = roster.find((candidate) => candidate.studentUserId === studentUserId);
  if (!row || !row.enrolled) return changes;
  return withMark(row, changes, effectiveStatus(row, changes) === status ? null : status);
}

/** "มาครบทุกคน": unmarked students expected at this meeting become present. Marks already chosen stay as they are. */
export function markAllPresent(roster: RosterRow[], changes: MarkChanges): MarkChanges {
  return roster.reduce<MarkChanges>(
    (next, row) => (row.enrolled && !row.joinedLater && effectiveStatus(row, next) === null ? withMark(row, next, "PRESENT") : next),
    changes,
  );
}

export function hasUnmarkedStudents(roster: RosterRow[], changes: MarkChanges): boolean {
  return roster.some((row) => row.enrolled && !row.joinedLater && effectiveStatus(row, changes) === null);
}

/** Keeps edits that still apply after the roster was reloaded (students who left, or marks now equal to the edit, drop out). */
export function pruneChanges(roster: RosterRow[], changes: MarkChanges): MarkChanges {
  const next: MarkChanges = {};
  for (const row of roster) {
    if (row.enrolled && row.studentUserId in changes && changes[row.studentUserId] !== row.status) {
      next[row.studentUserId] = changes[row.studentUserId];
    }
  }
  return next;
}

export function summarizeRoster(roster: RosterRow[], changes: MarkChanges): MeetingCounts {
  const counts: MeetingCounts = { present: 0, late: 0, absent: 0, unmarked: 0 };
  for (const row of roster) {
    const status = effectiveStatus(row, changes);
    if (status === "PRESENT") counts.present += 1;
    else if (status === "LATE") counts.late += 1;
    else if (status === "ABSENT") counts.absent += 1;
    else if (row.enrolled && !row.joinedLater) counts.unmarked += 1;
  }
  return counts;
}

/** PUT body: only what changed. `end` is sent only when the meeting has none: it sets a new meeting's end or fills a saved one's missing end. */
export function buildSaveBody(meeting: MeetingDetail, changes: MarkChanges, fallbackEnd: string | null): SaveAttendanceBody {
  const body: SaveAttendanceBody = {
    date: meeting.date,
    start: meeting.start,
    marks: Object.entries(changes).map(([studentUserId, status]) => ({ studentUserId, status })),
  };
  if (!meeting.end && fallbackEnd && fallbackEnd > meeting.start) body.end = fallbackEnd;
  return body;
}

export function attendanceErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "MEETING_NOT_STARTED":
      return t("tutorClass.attendance.errorNotStarted");
    case "STUDENT_NOT_ENROLLED":
      return t("tutorClass.attendance.errorNotEnrolled");
    case "ATTENDANCE_NOT_AVAILABLE":
      return t("tutorClass.attendance.errorNotAvailable");
    case "VALIDATION_FAILED":
      return t("tutorClass.attendance.errorInvalid");
    case "NOT_FOUND":
    case "FORBIDDEN":
      return t("tutorClass.setup.errorNotFound");
    case "UNAUTHORIZED":
      return t("tutorClass.setup.errorSession");
    default:
      return t("tutorClass.attendance.errorFailed");
  }
}

/* ─── Loading and navigation ─────────────────────────────────────────── */

export type AttendanceLoadFailure = "notFound" | "unavailable" | "failed";

/** How a page treats a failed load: 404/403 are "no such class", 409 is a class without attendance (demo, setup pending). */
export function loadFailureKind(httpStatus: number, code: string | null | undefined): AttendanceLoadFailure {
  if (httpStatus === 404 || httpStatus === 403) return "notFound";
  if (code === "ATTENDANCE_NOT_AVAILABLE") return "unavailable";
  return "failed";
}

/*
 * Back gesture over unsaved marks. A back from a soft navigation fires only
 * popstate, so while dirty the page keeps one extra same-URL history entry on
 * top. A back lands on the real entry with the page still mounted, and the
 * dialog then asks. Cancel puts the extra entry back; confirm goes back once more.
 */
export type BackGuardState = {
  dirty: boolean;
  /** The extra history entry is the current one. */
  onGuardEntry: boolean;
  /** Our own history.back() is on its way; its popstate is not the user's. */
  ignoringPop: boolean;
  askingBack: boolean;
  leaving: boolean;
};

export const BACK_GUARD_START: BackGuardState = {
  dirty: false,
  onGuardEntry: false,
  ignoringPop: false,
  askingBack: false,
  leaving: false,
};

export type BackGuardEvent = "dirty" | "clean" | "pop" | "cancel" | "confirm";
export type BackGuardEffect = "pushGuard" | "goBack" | null;

export function backGuardStep(state: BackGuardState, event: BackGuardEvent): { state: BackGuardState; effect: BackGuardEffect } {
  switch (event) {
    case "dirty":
      if (state.leaving || state.onGuardEntry || state.ignoringPop || state.askingBack) {
        return { state: { ...state, dirty: true }, effect: null };
      }
      return { state: { ...state, dirty: true, onGuardEntry: true }, effect: "pushGuard" };
    case "clean":
      // Saved or undone: take the extra entry away so it does not cost an extra back press.
      if (state.onGuardEntry) return { state: { ...state, dirty: false, onGuardEntry: false, ignoringPop: true }, effect: "goBack" };
      return { state: { ...state, dirty: false, askingBack: false }, effect: null };
    case "pop":
      if (state.leaving) return { state, effect: null };
      if (state.ignoringPop) {
        // Marked again while our back was still on its way.
        if (state.dirty) return { state: { ...state, ignoringPop: false, onGuardEntry: true }, effect: "pushGuard" };
        return { state: { ...state, ignoringPop: false }, effect: null };
      }
      if (state.onGuardEntry) return { state: { ...state, onGuardEntry: false, askingBack: true }, effect: null };
      return { state, effect: null };
    case "cancel":
      if (!state.askingBack) return { state, effect: null };
      return { state: { ...state, askingBack: false, onGuardEntry: true }, effect: "pushGuard" };
    case "confirm":
      if (!state.askingBack) return { state, effect: null };
      return { state: { ...state, askingBack: false, leaving: true }, effect: "goBack" };
  }
}

/**
 * The in-app path a link click would go to, when leaving should be confirmed
 * first. Null when the browser should handle the click as usual: new tabs,
 * downloads, other sites (beforeunload covers those) and links to this same page.
 */
export function guardedLinkTarget(
  link: { href: string; target: string; download: boolean; modified: boolean },
  currentHref: string,
): string | null {
  if (link.modified || link.download || (link.target && link.target !== "_self")) return null;
  let next: URL;
  let current: URL;
  try {
    current = new URL(currentHref);
    next = new URL(link.href, current);
  } catch {
    return null;
  }
  if (next.origin !== current.origin) return null;
  if (next.pathname === current.pathname && next.search === current.search) return null;
  return `${next.pathname}${next.search}${next.hash}`;
}
