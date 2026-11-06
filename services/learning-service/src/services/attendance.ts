/*
 * Attendance records: pure rules shared by the tutor/student (/v1/classes/:id/
 * attendance) and admin (/v1/admin/classes/:id/attendance) controllers. No I/O
 * here, so every rule is unit tested.
 *
 * Contract: which scheduled occurrences exist, how an occurrence maps to a saved
 * ClassMeeting row (including a moved time), when a meeting can be marked, input
 * validation, what a save changes, and the response shapes. Time is always
 * server-side Bangkok wall clock.
 */

import { addDays, bangkokDateKey, bangkokInstant } from "./bangkokTime";
import { isUuid, type Validated } from "./supportTickets";

export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const MEETING_SOURCES = ["SCHEDULED", "ADHOC"] as const;
export type MeetingSource = (typeof MEETING_SOURCES)[number];

export const LIMITS = {
  marksPerSaveMax: 200,
  weeklyLookbackDays: 120,
  adhocLookbackDays: 120,
  joinHintLeadMinutes: 30,
  joinHintDefaultHours: 3,
} as const;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export function isMeetingDate(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && bangkokInstant(value, "00:00") !== null;
}

export function isMeetingTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

// ── Scheduled occurrences ──────────────────────────────────────────────────

export type Occurrence = {
  /** Bangkok calendar day, yyyy-MM-dd */
  date: string;
  /** Bangkok wall-clock start, HH:mm */
  start: string;
  /** Bangkok wall-clock end, HH:mm; null when missing or not after start */
  end: string | null;
};

/**
 * Occurrences in Class.scheduleData between `from` (open-ended when omitted) and
 * `to`, inclusive, oldest first. Dated entries {date, start, end} are taken as
 * written. Legacy weekly entries {day, start | startTime, end} expand within
 * startsAt/endsAt (read as Bangkok calendar days) and never further back than
 * 120 days before `to`, because endsAt and startsAt may be missing. Malformed
 * entries are skipped, and the first entry wins for a repeated date + start.
 */
export function listScheduledOccurrences(
  scheduleData: unknown,
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  range: { from?: string; to: string },
): Occurrence[] {
  if (!Array.isArray(scheduleData)) return [];
  const from = range.from ?? "";
  const weeklyFrom = maxDate(from, startsAt ? bangkokDateKey(startsAt) : "", addDays(range.to, -LIMITS.weeklyLookbackDays));
  const weeklyTo = endsAt && bangkokDateKey(endsAt) < range.to ? bangkokDateKey(endsAt) : range.to;
  const seen = new Set<string>();
  const occurrences: Occurrence[] = [];

  const add = (date: string, start: string, end: string | null) => {
    const key = `${date}T${start}`;
    if (seen.has(key)) return;
    seen.add(key);
    occurrences.push({ date, start, end });
  };

  for (const entry of scheduleData) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const start = typeof item.start === "string" ? item.start : item.startTime;
    if (!isMeetingTime(start)) continue;
    const rawEnd = typeof item.end === "string" ? item.end : item.endTime;
    const end = isMeetingTime(rawEnd) && start < rawEnd ? rawEnd : null;

    if (typeof item.date === "string") {
      if (isMeetingDate(item.date) && item.date >= from && item.date <= range.to) add(item.date, start, end);
      continue;
    }
    if (typeof item.day !== "string") continue;
    const weekday = WEEKDAYS.indexOf(item.day.trim().toUpperCase());
    if (weekday < 0) continue;
    for (let date = weeklyFrom; date <= weeklyTo; date = addDays(date, 1)) {
      if (new Date(`${date}T00:00:00Z`).getUTCDay() === weekday) add(date, start, end);
    }
  }

  return occurrences.sort((a, b) => compareSlots(a, b));
}

/**
 * Schedule entries on one date. The range is that date alone, so the 120-day cap
 * never applies and the answer does not change as the date ages.
 */
export function scheduleEntriesOn(
  scheduleData: unknown,
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  date: string,
): Occurrence[] {
  return listScheduledOccurrences(scheduleData, startsAt, endsAt, { from: date, to: date });
}

function maxDate(...dates: string[]): string {
  return dates.reduce((latest, date) => (date > latest ? date : latest));
}

function compareSlots(a: { date: string; start: string }, b: { date: string; start: string }): number {
  return a.date.localeCompare(b.date) || a.start.localeCompare(b.start);
}

// ── Meeting identity ───────────────────────────────────────────────────────

export type MeetingRowFields = {
  meetingDate: string;
  startTime: string;
  endTime: string | null;
  source: string;
};

export type ResolvedMeeting<R extends MeetingRowFields> = {
  date: string;
  start: string;
  end: string | null;
  source: MeetingSource;
  /** The current schedule has an entry for this meeting. */
  inSchedule: boolean;
  /** The saved row's start, when the schedule has since moved this meeting to `start`. */
  movedFrom: string | null;
  row: R | null;
};

/**
 * The saved row a schedule entry now stands for, when its time moved after
 * marking: the date has one schedule entry and one scheduled meeting row, at
 * different times. An ADHOC row is a separate make-up lesson the tutor added on
 * purpose, so it neither merges nor counts as the moved row.
 */
function movedRowOn<R extends MeetingRowFields>(entries: Occurrence[], rows: R[]): R | null {
  if (entries.length !== 1) return null;
  const scheduled = rows.filter((row) => row.source !== "ADHOC");
  if (scheduled.length !== 1) return null;
  if (rows.some((row) => row.startTime === entries[0].start)) return null;
  return scheduled[0];
}

function fromRow<R extends MeetingRowFields>(row: R, entries: Occurrence[]): ResolvedMeeting<R> {
  return {
    date: row.meetingDate,
    start: row.startTime,
    end: row.endTime,
    source: row.source === "ADHOC" ? "ADHOC" : "SCHEDULED",
    inSchedule: entries.some((entry) => entry.start === row.startTime),
    movedFrom: null,
    row,
  };
}

function fromMovedRow<R extends MeetingRowFields>(row: R, entry: Occurrence): ResolvedMeeting<R> {
  return {
    date: row.meetingDate,
    start: entry.start,
    end: entry.end,
    source: "SCHEDULED",
    inSchedule: true,
    movedFrom: row.startTime,
    row,
  };
}

/**
 * The meeting behind `date` + `start`, given that date's schedule entries and
 * saved rows. Both the old and the new time of a moved meeting open the same row.
 */
export function resolveMeeting<R extends MeetingRowFields>(
  date: string,
  start: string,
  entries: Occurrence[],
  rows: R[],
): ResolvedMeeting<R> {
  const moved = movedRowOn(entries, rows);
  if (moved && (start === moved.startTime || start === entries[0].start)) return fromMovedRow(moved, entries[0]);

  const row = rows.find((candidate) => candidate.startTime === start);
  if (row) return fromRow(row, entries);

  const entry = entries.find((candidate) => candidate.start === start);
  if (entry) {
    return { date, start, end: entry.end, source: "SCHEDULED", inSchedule: true, movedFrom: null, row: null };
  }
  return { date, start, end: null, source: "ADHOC", inSchedule: false, movedFrom: null, row: null };
}

/**
 * Started occurrences plus every saved row, one meeting each, newest first.
 * `occurrences` decides which unmarked meetings are listed; `rowEntries` gives a
 * saved row's date its schedule entries, including dates older than that list.
 */
export function listMeetings<R extends MeetingRowFields>(
  occurrences: Occurrence[],
  rows: R[],
  now: Date,
  rowEntries: (date: string) => Occurrence[] = (date) => occurrences.filter((entry) => entry.date === date),
): ResolvedMeeting<R>[] {
  const dates = new Set([...occurrences.map((entry) => entry.date), ...rows.map((row) => row.meetingDate)]);
  const meetings: ResolvedMeeting<R>[] = [];
  for (const date of dates) {
    const entries = occurrences.filter((entry) => entry.date === date);
    const dayRows = rows.filter((row) => row.meetingDate === date);
    const savedEntries = rowEntries(date);
    const moved = movedRowOn(savedEntries, dayRows);
    for (const row of dayRows) {
      meetings.push(row === moved ? fromMovedRow(row, savedEntries[0]) : fromRow(row, savedEntries));
    }
    if (moved) continue;
    for (const entry of entries) {
      if (dayRows.some((row) => row.startTime === entry.start)) continue;
      if (hasStarted(date, entry.start, now)) {
        meetings.push({ date, start: entry.start, end: entry.end, source: "SCHEDULED", inSchedule: true, movedFrom: null, row: null });
      }
    }
  }
  return meetings.sort((a, b) => compareSlots(b, a));
}

// ── Marking rules ──────────────────────────────────────────────────────────

export function hasStarted(date: string, start: string, now: Date): boolean {
  const instant = bangkokInstant(date, start);
  return instant !== null && instant.getTime() <= now.getTime();
}

/**
 * Why a meeting cannot be marked now, or null when it can. A saved row can
 * always be corrected. A new meeting must have started, and one outside the
 * schedule must also be within the ad hoc window.
 */
export function markBlock(meeting: ResolvedMeeting<MeetingRowFields>, now: Date): "NOT_STARTED" | "TOO_OLD" | null {
  if (meeting.row) return null;
  if (!hasStarted(meeting.date, meeting.start, now)) return "NOT_STARTED";
  if (!meeting.inSchedule && meeting.date < addDays(bangkokDateKey(now), -LIMITS.adhocLookbackDays)) return "TOO_OLD";
  return null;
}

/**
 * The window in which a join counts as a hint: 30 minutes before start until the
 * end, or 3 hours after start when there is no end. A moved meeting spans both
 * its old and new times, since either may be when the lesson ran.
 */
export function joinHintWindow(meeting: ResolvedMeeting<MeetingRowFields>): { from: Date; to: Date } | null {
  const slots: { start: string; end: string | null }[] = [{ start: meeting.start, end: meeting.end }];
  if (meeting.movedFrom) slots.push({ start: meeting.movedFrom, end: meeting.row?.endTime ?? null });
  let from: number | null = null;
  let to: number | null = null;
  for (const slot of slots) {
    const start = bangkokInstant(meeting.date, slot.start);
    if (!start) return null;
    const end = slot.end ? bangkokInstant(meeting.date, slot.end) : null;
    const slotFrom = start.getTime() - LIMITS.joinHintLeadMinutes * MINUTE_MS;
    const slotTo = end ? end.getTime() : start.getTime() + LIMITS.joinHintDefaultHours * HOUR_MS;
    from = from === null ? slotFrom : Math.min(from, slotFrom);
    to = to === null ? slotTo : Math.max(to, slotTo);
  }
  return from === null || to === null ? null : { from: new Date(from), to: new Date(to) };
}

export type MarkInput = { studentUserId: string; status: AttendanceStatus | null };

export type MarkPlan = {
  creates: { studentUserId: string; status: AttendanceStatus }[];
  updates: { studentUserId: string; status: AttendanceStatus }[];
  removes: string[];
};

/** What a save changes. A mark that repeats the current state changes nothing. */
export function planMarkChanges(existing: { studentUserId: string; status: string }[], marks: MarkInput[]): MarkPlan {
  const current = new Map(existing.map((record) => [record.studentUserId.toLowerCase(), record.status]));
  const plan: MarkPlan = { creates: [], updates: [], removes: [] };
  for (const { studentUserId, status } of marks) {
    const before = current.get(studentUserId) ?? null;
    if (before === status) continue;
    if (status === null) plan.removes.push(studentUserId);
    else if (before === null) plan.creates.push({ studentUserId, status });
    else plan.updates.push({ studentUserId, status });
  }
  return plan;
}

export function changedStudentIds(plan: MarkPlan): string[] {
  return [...plan.creates.map((mark) => mark.studentUserId), ...plan.updates.map((mark) => mark.studentUserId), ...plan.removes];
}

// ── Validation ─────────────────────────────────────────────────────────────

type ValidationFailure = Extract<Validated<never>, { ok: false }>;

function fail(message: string): ValidationFailure {
  return { ok: false, code: "VALIDATION_FAILED", message };
}

export function validateMeetingQuery(query: Record<string, unknown>): Validated<{ date: string; start: string }> {
  if (!isMeetingDate(query.date)) return fail("date must be a real yyyy-MM-dd date");
  if (!isMeetingTime(query.start)) return fail("start must be HH:mm");
  return { ok: true, value: { date: query.date, start: query.start } };
}

export type SaveMarksInput = { date: string; start: string; end: string | null; marks: MarkInput[] };

export function validateSaveMarks(raw: unknown): Validated<SaveMarksInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("Body must be an object");
  const body = raw as Record<string, unknown>;
  const meeting = validateMeetingQuery(body);
  if (!meeting.ok) return meeting;
  const { date, start } = meeting.value;

  let end: string | null = null;
  if (body.end !== undefined && body.end !== null) {
    if (!isMeetingTime(body.end)) return fail("end must be HH:mm");
    if (body.end <= start) return fail("end must be after start");
    end = body.end;
  }

  if (!Array.isArray(body.marks)) return fail("marks must be an array");
  if (body.marks.length > LIMITS.marksPerSaveMax) return fail(`At most ${LIMITS.marksPerSaveMax} marks per save`);
  const seen = new Set<string>();
  const marks: MarkInput[] = [];
  for (const entry of body.marks) {
    if (!entry || typeof entry !== "object") return fail("Each mark must be an object");
    const mark = entry as Record<string, unknown>;
    if (!isUuid(mark.studentUserId)) return fail("studentUserId must be a UUID");
    if (mark.status !== null && !isAttendanceStatus(mark.status)) return fail("status must be PRESENT, LATE, ABSENT or null");
    const studentUserId = mark.studentUserId.toLowerCase();
    if (seen.has(studentUserId)) return fail("Each student can appear only once");
    seen.add(studentUserId);
    marks.push({ studentUserId, status: mark.status });
  }
  return { ok: true, value: { date, start, end, marks } };
}

// ── Response shapes ────────────────────────────────────────────────────────

export type StatusCounts = { present: number; late: number; absent: number };

export type StudentUser = { userId: string; displayName: string | null; profilePictureUrl: string | null };

export type RosterRow = {
  studentUserId: string;
  name: string | null;
  avatarUrl: string | null;
  status: AttendanceStatus | null;
  joinedAt: string | null;
  enrolled: boolean;
  /** Active, but enrolled after this meeting's date: not expected, and left out of "unmarked". */
  joinedLater: boolean;
};

export type MeetingSummary = {
  date: string;
  start: string;
  end: string | null;
  source: MeetingSource;
  inSchedule: boolean;
  movedFrom: string | null;
  counts: StatusCounts & { unmarked: number };
  marked: boolean;
};

export type StudentAttendanceStats = StatusCounts & {
  studentUserId: string;
  name: string | null;
  avatarUrl: string | null;
  rate: number | null;
};

export function countStatuses(statuses: string[]): StatusCounts {
  const counts: StatusCounts = { present: 0, late: 0, absent: 0 };
  for (const status of statuses) {
    if (status === "PRESENT") counts.present += 1;
    else if (status === "LATE") counts.late += 1;
    else if (status === "ABSENT") counts.absent += 1;
  }
  return counts;
}

/** (present + late) / marked. Unmarked meetings are not counted; null when nothing is marked. */
export function attendanceRate(counts: StatusCounts): number | null {
  const marked = counts.present + counts.late + counts.absent;
  return marked === 0 ? null : (counts.present + counts.late) / marked;
}

function byName(a: { name: string | null; studentUserId: string }, b: { name: string | null; studentUserId: string }): number {
  return (a.name ?? "").localeCompare(b.name ?? "", "th") || a.studentUserId.localeCompare(b.studentUserId);
}

/** Active students expected at a meeting: those enrolled on or before its Bangkok date. */
export function expectedStudentIds(enrolledAt: Map<string, Date>, meetingDate: string): string[] {
  return [...enrolledAt].filter(([, at]) => bangkokDateKey(at) <= meetingDate).map(([studentUserId]) => studentUserId);
}

/** ACTIVE students plus anyone already marked. Only ACTIVE rows can be changed. */
export function buildRoster(
  activeStudentIds: string[],
  records: { studentUserId: string; status: string }[],
  users: StudentUser[],
  joins: Map<string, Date>,
  expectedIds: string[],
): RosterRow[] {
  const active = new Set(activeStudentIds);
  const expected = new Set(expectedIds);
  const statuses = new Map(records.map((record) => [record.studentUserId, record.status]));
  const userById = new Map(users.map((user) => [user.userId, user]));
  return [...new Set([...activeStudentIds, ...statuses.keys()])]
    .map((studentUserId) => {
      const user = userById.get(studentUserId);
      const status = statuses.get(studentUserId);
      return {
        studentUserId,
        name: user?.displayName ?? null,
        avatarUrl: user?.profilePictureUrl ?? null,
        status: isAttendanceStatus(status) ? status : null,
        joinedAt: joins.get(studentUserId)?.toISOString() ?? null,
        enrolled: active.has(studentUserId),
        joinedLater: active.has(studentUserId) && !expected.has(studentUserId),
      };
    })
    .sort(byName);
}

export function toMeetingSummary(
  meeting: ResolvedMeeting<MeetingRowFields>,
  records: { studentUserId: string; status: string }[],
  expectedIds: string[],
): MeetingSummary {
  const markedIds = new Set(records.map((record) => record.studentUserId));
  return {
    date: meeting.date,
    start: meeting.start,
    end: meeting.end,
    source: meeting.source,
    inSchedule: meeting.inSchedule,
    movedFrom: meeting.movedFrom,
    counts: {
      ...countStatuses(records.map((record) => record.status)),
      unmarked: expectedIds.filter((id) => !markedIds.has(id)).length,
    },
    marked: records.length > 0,
  };
}

/** ACTIVE students plus anyone with a mark in this class, sorted by name. */
export function buildStudentStats(
  activeStudentIds: string[],
  records: { studentUserId: string; status: string }[],
  users: StudentUser[],
): StudentAttendanceStats[] {
  const statuses = new Map<string, string[]>(activeStudentIds.map((id) => [id, []]));
  for (const record of records) {
    statuses.set(record.studentUserId, [...(statuses.get(record.studentUserId) ?? []), record.status]);
  }
  const userById = new Map(users.map((user) => [user.userId, user]));
  return [...statuses.entries()]
    .map(([studentUserId, list]) => {
      const counts = countStatuses(list);
      const user = userById.get(studentUserId);
      return {
        studentUserId,
        name: user?.displayName ?? null,
        avatarUrl: user?.profilePictureUrl ?? null,
        ...counts,
        rate: attendanceRate(counts),
      };
    })
    .sort(byName);
}

export type MyAttendanceRecord = { date: string; start: string; end: string | null; status: string };

/** A student's own view: summary and records, newest first. */
export function toMyAttendance(
  records: { status: string; meeting: { meetingDate: string; startTime: string; endTime: string | null } }[],
): { summary: StatusCounts & { rate: number | null }; records: MyAttendanceRecord[] } {
  const counts = countStatuses(records.map((record) => record.status));
  return {
    summary: { ...counts, rate: attendanceRate(counts) },
    records: records
      .map((record) => ({
        date: record.meeting.meetingDate,
        start: record.meeting.startTime,
        end: record.meeting.endTime,
        status: record.status,
      }))
      .sort((a, b) => compareSlots(b, a)),
  };
}
