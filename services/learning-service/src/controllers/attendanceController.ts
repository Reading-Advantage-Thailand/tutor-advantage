import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma, Prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  buildRoster,
  buildStudentStats,
  changedStudentIds,
  expectedStudentIds,
  joinHintWindow,
  listMeetings,
  listScheduledOccurrences,
  markBlock,
  planMarkChanges,
  resolveMeeting,
  scheduleEntriesOn,
  toMeetingSummary,
  toMyAttendance,
  validateMeetingQuery,
  validateSaveMarks,
  type MeetingRowFields,
  type ResolvedMeeting,
} from "../services/attendance";
import { bangkokDateKey } from "../services/bangkokTime";
import { isUuid } from "../services/supportTickets";
import { errorBody } from "./ticketController";

/*
 * Attendance per class meeting. The owning tutor marks and reads everything; a
 * student reads only their own marks; the admin view (adminAttendanceController)
 * is read-only. A malformed or unknown class id is 404. Nothing here touches
 * money, hours, reminders or LINE.
 */

export class AttendanceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function sendAttendanceError(req: AuthenticatedRequest, res: Response, error: unknown, context: string) {
  if (error instanceof AttendanceError) {
    return res.status(error.status).json(errorBody(req, error.code, error.message));
  }
  logger.error(`[Attendance] ${context} failed`, error);
  return res.status(500).json(errorBody(req, "INTERNAL_SERVER_ERROR", `${context} failed`));
}

const classSelect = {
  classId: true,
  title: true,
  tutorUserId: true,
  isDemo: true,
  setupRequiredAt: true,
  scheduleData: true,
  startsAt: true,
  endsAt: true,
} satisfies Prisma.ClassSelect;

export type AttendanceClass = Prisma.ClassGetPayload<{ select: typeof classSelect }>;

/** The class by id, or 404 for an unknown or malformed id. */
export async function loadClass(db: Prisma.TransactionClient, classId: unknown): Promise<AttendanceClass> {
  const cls = isUuid(classId) ? await db.class.findUnique({ where: { classId }, select: classSelect }) : null;
  if (!cls) throw new AttendanceError(404, "NOT_FOUND", "Class not found");
  return cls;
}

/** Demo classes and classes still waiting for tutor setup have no attendance. */
export function assertAttendanceAvailable(cls: AttendanceClass) {
  if (cls.isDemo || cls.setupRequiredAt) {
    throw new AttendanceError(409, "ATTENDANCE_NOT_AVAILABLE", "Attendance is not available for this class");
  }
}

function assertOwner(cls: AttendanceClass, userId: string) {
  if (cls.tutorUserId !== userId) {
    throw new AttendanceError(403, "FORBIDDEN", "Only the class tutor can do this");
  }
}

/** The caller as a tutor, or null after answering 401/403. */
function tutorFrom(req: AuthenticatedRequest, res: Response): string | null {
  if (!req.user?.userId) {
    res.status(401).json(errorBody(req, "UNAUTHORIZED", "Authentication required"));
    return null;
  }
  if (req.user.role !== "TUTOR") {
    res.status(403).json(errorBody(req, "FORBIDDEN", "Only the class tutor can do this"));
    return null;
  }
  return req.user.userId;
}

/** ACTIVE students with their earliest enrollment time. There is no activation column, so createdAt stands in. */
async function activeEnrollments(db: Prisma.TransactionClient, classId: string): Promise<Map<string, Date>> {
  const enrollments = await db.enrollment.findMany({
    where: { classId, status: "ACTIVE" },
    select: { studentUserId: true, createdAt: true },
  });
  const enrolledAt = new Map<string, Date>();
  for (const { studentUserId, createdAt } of enrollments) {
    const earliest = enrolledAt.get(studentUserId);
    if (!earliest || createdAt < earliest) enrolledAt.set(studentUserId, createdAt);
  }
  return enrolledAt;
}

function loadUsers(userIds: string[]) {
  return prisma.user.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, displayName: true, profilePictureUrl: true },
  });
}

function entriesOn(cls: AttendanceClass, date: string) {
  return scheduleEntriesOn(cls.scheduleData, cls.startsAt, cls.endsAt, date);
}

/** Meeting list and per-student totals, shared by the tutor and admin views. */
export async function loadAttendanceOverview(cls: AttendanceClass, now: Date) {
  const [rows, enrolledAt] = await Promise.all([
    prisma.classMeeting.findMany({
      where: { classId: cls.classId },
      include: { records: { select: { studentUserId: true, status: true } } },
    }),
    activeEnrollments(prisma, cls.classId),
  ]);
  const activeIds = [...enrolledAt.keys()];
  const occurrences = listScheduledOccurrences(cls.scheduleData, cls.startsAt, cls.endsAt, { to: bangkokDateKey(now) });
  const records = rows.flatMap((row) => row.records);
  const users = await loadUsers([...new Set([...activeIds, ...records.map((record) => record.studentUserId)])]);
  return {
    meetings: listMeetings(occurrences, rows, now, (date) => entriesOn(cls, date)).map((meeting) =>
      toMeetingSummary(meeting, meeting.row?.records ?? [], expectedStudentIds(enrolledAt, meeting.date)),
    ),
    students: buildStudentStats(activeIds, records, users),
  };
}

/** Earliest join per student in the hint window, across all of this class's sessions of any status. */
async function loadJoinHints(classId: string, meeting: ResolvedMeeting<MeetingRowFields>, now: Date) {
  const window = joinHintWindow(meeting);
  if (!window || window.from.getTime() > now.getTime()) return new Map<string, Date>();
  const joins = await prisma.sessionParticipant.groupBy({
    by: ["studentUserId"],
    where: { session: { classId }, joinedAt: { gte: window.from, lte: window.to } },
    _min: { joinedAt: true },
  });
  const hints = new Map<string, Date>();
  for (const join of joins) {
    if (join._min.joinedAt) hints.set(join.studentUserId, join._min.joinedAt);
  }
  return hints;
}

async function loadMeetingBody(cls: AttendanceClass, date: string, start: string, now: Date) {
  const rows = await prisma.classMeeting.findMany({ where: { classId: cls.classId, meetingDate: date } });
  const meeting = resolveMeeting(date, start, entriesOn(cls, date), rows);
  const [enrolledAt, records, joins] = await Promise.all([
    activeEnrollments(prisma, cls.classId),
    meeting.row
      ? prisma.attendanceRecord.findMany({
          where: { meetingId: meeting.row.meetingId },
          select: { studentUserId: true, status: true },
        })
      : Promise.resolve([]),
    loadJoinHints(cls.classId, meeting, now),
  ]);
  const activeIds = [...enrolledAt.keys()];
  const users = await loadUsers([...new Set([...activeIds, ...records.map((record) => record.studentUserId)])]);
  return {
    meeting: {
      date: meeting.date,
      start: meeting.start,
      end: meeting.end,
      source: meeting.source,
      inSchedule: meeting.inSchedule,
      movedFrom: meeting.movedFrom,
      markable: markBlock(meeting, now) === null,
    },
    roster: buildRoster(activeIds, records, users, joins, expectedStudentIds(enrolledAt, meeting.date)),
  };
}

// GET /v1/classes/:classId/attendance
export async function getClassAttendance(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json(errorBody(req, "UNAUTHORIZED", "Authentication required"));
  const role = req.user?.role;
  if (role !== "TUTOR" && role !== "STUDENT") {
    return res.status(403).json(errorBody(req, "FORBIDDEN", "Only the class tutor or its students can do this"));
  }
  try {
    const cls = await loadClass(prisma, req.params.classId);
    if (role === "TUTOR") {
      assertOwner(cls, userId);
      assertAttendanceAvailable(cls);
      return res.status(200).json(await loadAttendanceOverview(cls, new Date()));
    }

    // Any enrollment, whatever its status: a student keeps their history after a refund.
    const enrollment = await prisma.enrollment.findFirst({
      where: { classId: cls.classId, studentUserId: userId },
      select: { classId: true },
    });
    if (!enrollment) throw new AttendanceError(404, "NOT_FOUND", "Class not found");
    assertAttendanceAvailable(cls);
    const records = await prisma.attendanceRecord.findMany({
      where: { studentUserId: userId, meeting: { classId: cls.classId } },
      select: { status: true, meeting: { select: { meetingDate: true, startTime: true, endTime: true } } },
    });
    return res.status(200).json({ mine: toMyAttendance(records) });
  } catch (error) {
    return sendAttendanceError(req, res, error, "Load attendance");
  }
}

// GET /v1/classes/:classId/attendance/meeting?date=&start=
export async function getAttendanceMeeting(req: AuthenticatedRequest, res: Response) {
  const userId = tutorFrom(req, res);
  if (!userId) return;
  try {
    const cls = await loadClass(prisma, req.params.classId);
    assertOwner(cls, userId);
    assertAttendanceAvailable(cls);
    const parsed = validateMeetingQuery(req.query as Record<string, unknown>);
    if (!parsed.ok) return res.status(400).json(errorBody(req, parsed.code, parsed.message));
    return res.status(200).json(await loadMeetingBody(cls, parsed.value.date, parsed.value.start, new Date()));
  } catch (error) {
    return sendAttendanceError(req, res, error, "Load attendance meeting");
  }
}

// PUT /v1/classes/:classId/attendance/meeting
export async function saveAttendanceMeeting(req: AuthenticatedRequest, res: Response) {
  const userId = tutorFrom(req, res);
  if (!userId) return;
  const classId = req.params.classId;
  if (!isUuid(classId)) return res.status(404).json(errorBody(req, "NOT_FOUND", "Class not found"));
  const parsed = validateSaveMarks(req.body);
  if (!parsed.ok) return res.status(400).json(errorBody(req, parsed.code, parsed.message));
  const { date, start, end, marks } = parsed.value;

  try {
    const cls = await prisma.$transaction(async (tx) => {
      // One save at a time per class, so creating or removing a meeting row cannot race.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance-class:${classId}`}::text))`;
      const current = await loadClass(tx, classId);
      assertOwner(current, userId);
      assertAttendanceAvailable(current);
      const now = new Date();

      const rows = await tx.classMeeting.findMany({ where: { classId, meetingDate: date } });
      const meeting = resolveMeeting(date, start, entriesOn(current, date), rows);
      const block = markBlock(meeting, now);
      if (block === "NOT_STARTED") throw new AttendanceError(409, "MEETING_NOT_STARTED", "This meeting has not started yet");
      if (block === "TOO_OLD") throw new AttendanceError(400, "VALIDATION_FAILED", "A make-up meeting cannot be older than 120 days");

      const existing = meeting.row
        ? await tx.attendanceRecord.findMany({
            where: { meetingId: meeting.row.meetingId },
            select: { studentUserId: true, status: true },
          })
        : [];
      const plan = planMarkChanges(existing, marks);
      const changed = changedStudentIds(plan);
      if (changed.length === 0) return current;

      const stillActive = await tx.enrollment.findMany({
        where: { classId, status: "ACTIVE", studentUserId: { in: changed } },
        select: { studentUserId: true },
      });
      const activeIds = new Set(stillActive.map((enrollment) => enrollment.studentUserId));
      if (changed.some((id) => !activeIds.has(id))) {
        throw new AttendanceError(409, "STUDENT_NOT_ENROLLED", "Marks can be changed only for students active in this class");
      }

      const meetingId =
        meeting.row?.meetingId ??
        (
          await tx.classMeeting.create({
            data: {
              classId,
              meetingDate: date,
              startTime: meeting.start,
              endTime: meeting.end ?? end,
              source: meeting.source,
              createdByUserId: userId,
            },
          })
        ).meetingId;

      if (plan.creates.length > 0) {
        await tx.attendanceRecord.createMany({
          data: plan.creates.map((mark) => ({
            meetingId,
            studentUserId: mark.studentUserId,
            status: mark.status,
            markedByUserId: userId,
            markedAt: now,
          })),
        });
      }
      for (const status of new Set(plan.updates.map((mark) => mark.status))) {
        await tx.attendanceRecord.updateMany({
          where: {
            meetingId,
            studentUserId: { in: plan.updates.filter((mark) => mark.status === status).map((mark) => mark.studentUserId) },
          },
          data: { status, markedByUserId: userId, markedAt: now },
        });
      }
      if (plan.removes.length > 0) {
        await tx.attendanceRecord.deleteMany({ where: { meetingId, studentUserId: { in: plan.removes } } });
      }

      if (meeting.row) {
        const remaining = existing.length + plan.creates.length - plan.removes.length;
        if (remaining === 0) await tx.classMeeting.delete({ where: { meetingId } });
        else {
          // A typed end fills a missing one and never replaces a saved end. A moved meeting shows its schedule's end, not the row's.
          const fillEnd = meeting.row.endTime === null && !meeting.movedFrom && end !== null;
          await tx.classMeeting.update({ where: { meetingId }, data: { updatedAt: now, ...(fillEnd ? { endTime: end } : {}) } });
        }
      }

      // First-time marks are normal work; only a change to an earlier mark is audited.
      if (plan.updates.length > 0 || plan.removes.length > 0) {
        await tx.auditEvent.create({
          data: {
            actorId: userId,
            action: "ATTENDANCE_CORRECT",
            entityType: "CLASS_MEETING",
            entityId: meetingId,
            payload: { created: plan.creates.length, changed: plan.updates.length, removed: plan.removes.length },
          },
        });
      }
      return current;
    });
    return res.status(200).json(await loadMeetingBody(cls, date, start, new Date()));
  } catch (error) {
    return sendAttendanceError(req, res, error, "Save attendance");
  }
}
