import { prisma, Prisma } from "@tutor-advantage/database";
import { hashIdentifier, logger } from "@tutor-advantage/shared-config";
import { LineNotificationService, LineNotificationResult } from "./LineNotificationService";
import { addDays, bangkokDateKey, bangkokInstant } from "./bangkokTime";

export { bangkokDateKey };

// Scheduled LINE reminders, triggered by Cloud Scheduler through
// /v1/internal/reminders/*. Each reminder is claimed in
// learning.notification_deliveries before it is sent, so a retried or
// overlapping run never sends the same reminder twice.

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export type ReminderKind = "CLASS_SESSION_REMINDER" | "BOOK_PAYMENT_REMINDER";

export const DEFAULT_LEAD_MINUTES = 15;
export const MAX_DELIVERIES_PER_RUN = 500;
export const MAX_ATTEMPTS = 3;
// A CLAIMED row older than this belongs to a run that died mid-send. Class
// reminders use less than the 5-minute cron interval so the next run, still
// before the session starts, can recover it; both are far longer than one push.
export const STALE_CLAIM_MS: Record<ReminderKind, number> = {
  CLASS_SESSION_REMINDER: 4 * 60 * 1000,
  BOOK_PAYMENT_REMINDER: 10 * 60 * 1000,
};
// LINE remembers an X-Line-Retry-Key for 24 hours only. A row first claimed
// longer ago than this whose earlier attempt may have reached LINE is not
// retried: the key could no longer stop a second push.
export const RETRY_KEY_WINDOW_MS = 20 * 60 * 60 * 1000;
export const PAYMENT_MILESTONE_DAYS = [1, 3, 7] as const;
export const PAYMENT_REMINDER_LAST_DAY = 14;
const SEND_CONCURRENCY = 10;
// endsAt is UTC midnight of the last teaching day; keep classes a little past it.
const ENDED_CLASS_GRACE_MS = 2 * DAY_MS;

export type SessionStart = {
  /** Bangkok calendar day, yyyy-MM-dd */
  date: string;
  /** Bangkok wall-clock start, HH:mm */
  start: string;
  startsAt: Date;
};

export type ReminderCandidate = {
  dedupKey: string;
  kind: ReminderKind;
  userId: string;
  classId: string | null;
  send: (retryKey: string) => Promise<LineNotificationResult>;
};

export type ReminderSummary = {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
  alreadyHandled: number;
};

type DeliveryRow = {
  deliveryId: string;
  dedupKey: string;
  status: string;
  reason: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Upcoming session starts (strictly after `now`) from Class.scheduleData.
 * Dated entries {date, start} are Bangkok wall-clock times. Legacy weekly
 * entries {day: "MON".."SUN", start | startTime} expand to today and tomorrow
 * (Bangkok), clamped to startsAt/endsAt read as Bangkok calendar days.
 * Malformed entries are ignored.
 */
export function sessionStartsFromSchedule(
  scheduleData: unknown,
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  now: Date,
): SessionStart[] {
  if (!Array.isArray(scheduleData)) return [];
  const today = bangkokDateKey(now);
  const firstDay = startsAt ? bangkokDateKey(startsAt) : null;
  const lastDay = endsAt ? bangkokDateKey(endsAt) : null;
  const seen = new Set<string>();
  const sessions: SessionStart[] = [];

  const add = (date: string, start: string) => {
    const instant = bangkokInstant(date, start);
    if (!instant || instant.getTime() <= now.getTime()) return;
    const key = `${date}T${start}`;
    if (seen.has(key)) return;
    seen.add(key);
    sessions.push({ date, start, startsAt: instant });
  };

  for (const entry of scheduleData) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const start = typeof item.start === "string" ? item.start : item.startTime;
    if (typeof start !== "string" || !TIME_RE.test(start)) continue;

    if (typeof item.date === "string") {
      if (DATE_RE.test(item.date)) add(item.date, start);
      continue;
    }
    if (typeof item.day !== "string") continue;
    const weekday = WEEKDAYS.indexOf(item.day.trim().toUpperCase());
    if (weekday < 0) continue;
    for (const date of [today, addDays(today, 1)]) {
      if (new Date(`${date}T00:00:00Z`).getUTCDay() !== weekday) continue;
      if (firstDay && date < firstDay) continue;
      if (lastDay && date > lastDay) continue;
      add(date, start);
    }
  }

  return sessions.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Sessions whose start is in (now, now + leadMinutes]. */
export function sessionsDueForReminder(sessions: SessionStart[], now: Date, leadMinutes: number) {
  const until = now.getTime() + leadMinutes * 60 * 1000;
  return sessions.filter((session) =>
    session.startsAt.getTime() > now.getTime() && session.startsAt.getTime() <= until,
  );
}

/** Whole Bangkok calendar days between package creation and now. */
export function bangkokDaysSince(createdAt: Date, now: Date): number {
  return Math.round(
    (Date.parse(`${bangkokDateKey(now)}T00:00:00Z`) - Date.parse(`${bangkokDateKey(createdAt)}T00:00:00Z`)) / DAY_MS,
  );
}

/**
 * The follow-up to send for an unpaid book: the largest milestone (day 1, 3
 * or 7) reached so far. Missed earlier milestones are not back-filled, and
 * nothing is sent after day 14.
 */
export function paymentReminderMilestone(createdAt: Date, now: Date): number | null {
  const days = bangkokDaysSince(createdAt, now);
  if (days > PAYMENT_REMINDER_LAST_DAY) return null;
  const reached = PAYMENT_MILESTONE_DAYS.filter((milestone) => days >= milestone);
  return reached.length ? reached[reached.length - 1] : null;
}

export function classSessionDedupKey(classId: string, session: Pick<SessionStart, "date" | "start">, studentUserId: string) {
  return `class-session:${classId}:${session.date}T${session.start}:${studentUserId}`;
}

export function bookPaymentDedupKey(enrollmentPackageId: string, milestone: number) {
  return `book-payment:${enrollmentPackageId}:d${milestone}`;
}

export function buildClassSessionReminderCard(
  classId: string,
  classTitle: string,
  session: Pick<SessionStart, "start" | "startsAt">,
  now: Date,
) {
  const minutes = Math.max(1, Math.ceil((session.startsAt.getTime() - now.getTime()) / 60000));
  const classUrl = LineNotificationService.buildLiffDeepLink(`/classes/${classId}`);
  const altText = `คลาส "${classTitle}" จะเริ่มในอีก ${minutes} นาที (${session.start} น.)`;
  const card: Record<string, unknown> = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#06C755",
      paddingAll: "16px",
      contents: [{ type: "text", text: "Tutor Advantage", color: "#FFFFFF", weight: "bold", size: "lg" }],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: `คลาสจะเริ่มในอีก ${minutes} นาที`, weight: "bold", size: "xl", wrap: true },
        { type: "text", text: classTitle, size: "sm", color: "#666666", wrap: true },
        { type: "separator", margin: "md" },
        { type: "text", text: `เวลา ${session.start} น.`, size: "md", weight: "bold", wrap: true },
      ],
    },
  };
  if (classUrl) {
    card.footer = {
      type: "box",
      layout: "vertical",
      contents: [{
        type: "button",
        style: "primary",
        color: "#06C755",
        action: { type: "uri", label: "ดูคลาส", uri: classUrl },
      }],
    };
  }
  return { altText, card };
}

export function buildBookPaymentReminderText(params: {
  bookTitle: string;
  classTitle: string;
  classId: string;
  cycleId: string;
}) {
  const paymentLink = LineNotificationService.buildLiffDeepLink(
    `/payment?classId=${params.classId}&cycleId=${params.cycleId}`,
  );
  return [
    `ยังไม่ได้ชำระค่าเล่ม: ${params.bookTitle}`,
    `คลาส "${params.classTitle}"`,
    "ชำระเงินเพื่อเข้าเรียนสดของเล่มนี้",
    paymentLink ? `ชำระเงิน: ${paymentLink}` : "",
  ].filter(Boolean).join("\n");
}

type OutcomeUpdate = { status: "SENT" | "SKIPPED" | "FAILED"; reason: string | null };

/** Permanent reasons are SKIPPED; anything that may succeed later is FAILED. */
export function deliveryOutcome(result: LineNotificationResult): OutcomeUpdate {
  if (result.sent) return { status: "SENT", reason: null };
  switch (result.reason) {
    case "PREFERENCE_DISABLED":
    case "LINE_NOT_LINKED":
    case "USER_NOT_FOUND":
      return { status: "SKIPPED", reason: result.reason };
    case "LINE_API_ERROR":
      return { status: "FAILED", reason: result.lineStatus ? `LINE_API_${result.lineStatus}` : "LINE_API_ERROR" };
    default:
      return { status: "FAILED", reason: result.reason || "UNEXPECTED_ERROR" };
  }
}

/**
 * True when the row's earlier attempt may have been accepted by LINE: a claim
 * that never recorded an outcome, a thrown/unknown error, or a LINE 5xx. A
 * LINE 4xx or LINE_NOT_CONFIGURED means LINE never took the push.
 */
export function attemptMayHaveReachedLine(row: Pick<DeliveryRow, "status" | "reason">) {
  if (row.status === "CLAIMED") return true;
  if (row.status !== "FAILED") return false;
  if (!row.reason || row.reason === "UNEXPECTED_ERROR" || row.reason === "LINE_API_ERROR") return true;
  return /^LINE_API_5\d\d$/.test(row.reason);
}

/** True when a retry could no longer rely on LINE's 24-hour retry-key memory. */
export function retryKeyExpired(row: Pick<DeliveryRow, "status" | "reason" | "createdAt">, now: Date) {
  return now.getTime() - row.createdAt.getTime() > RETRY_KEY_WINDOW_MS && attemptMayHaveReachedLine(row);
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string } | null)?.code === "P2002";
}

/**
 * Claims a delivery row so this run alone may send it. Returns the deliveryId
 * (also the LINE retry key) or null when another run handled or holds it.
 */
async function claimDelivery(
  candidate: ReminderCandidate,
  existing: DeliveryRow | undefined,
  now: Date,
): Promise<string | null> {
  if (!existing) {
    try {
      const row = await prisma.notificationDelivery.create({
        data: {
          dedupKey: candidate.dedupKey,
          kind: candidate.kind,
          userId: candidate.userId,
          classId: candidate.classId,
          status: "CLAIMED",
        },
        select: { deliveryId: true },
      });
      return row.deliveryId;
    } catch (error) {
      if (isUniqueViolation(error)) return null; // a concurrent run created it
      throw error;
    }
  }

  if (existing.attempts >= MAX_ATTEMPTS) return null;
  if (existing.status === "FAILED") {
    const { count } = await prisma.notificationDelivery.updateMany({
      where: { deliveryId: existing.deliveryId, status: "FAILED", attempts: { lt: MAX_ATTEMPTS } },
      data: { status: "CLAIMED", updatedAt: now },
    });
    return count === 1 ? existing.deliveryId : null;
  }
  const staleClaimMs = STALE_CLAIM_MS[candidate.kind];
  if (existing.status === "CLAIMED" && now.getTime() - existing.updatedAt.getTime() > staleClaimMs) {
    // The run that claimed it died mid-send. The retry key stops a double push
    // if LINE did accept it; the abandoned attempt still counts.
    const { count } = await prisma.notificationDelivery.updateMany({
      where: {
        deliveryId: existing.deliveryId,
        status: "CLAIMED",
        updatedAt: { lt: new Date(now.getTime() - staleClaimMs) },
        attempts: { lt: MAX_ATTEMPTS },
      },
      data: { status: "CLAIMED", updatedAt: now, attempts: { increment: 1 } },
    });
    return count === 1 ? existing.deliveryId : null;
  }
  return null;
}

/** True when a row exists and needs no work from this run. */
function isSettled(row: DeliveryRow | undefined, kind: ReminderKind, now: Date) {
  if (!row) return false;
  if (row.attempts >= MAX_ATTEMPTS) return true;
  if (row.status === "FAILED") return false;
  if (row.status === "CLAIMED") return now.getTime() - row.updatedAt.getTime() <= STALE_CLAIM_MS[kind];
  return true; // SENT / SKIPPED
}

async function loadExistingDeliveries(dedupKeys: string[]) {
  const rows = new Map<string, DeliveryRow>();
  for (let index = 0; index < dedupKeys.length; index += 1000) {
    const found = await prisma.notificationDelivery.findMany({
      where: { dedupKey: { in: dedupKeys.slice(index, index + 1000) } },
      select: {
        deliveryId: true,
        dedupKey: true,
        status: true,
        reason: true,
        attempts: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    for (const row of found) rows.set(row.dedupKey, row);
  }
  return rows;
}

async function deliverOne(
  candidate: ReminderCandidate,
  existing: DeliveryRow | undefined,
  now: Date,
): Promise<"sent" | "skipped" | "failed" | "alreadyHandled"> {
  if (existing && retryKeyExpired(existing, now)) {
    // Retrying now could push a second copy; give up on this reminder instead.
    const { count } = await prisma.notificationDelivery.updateMany({
      where: { deliveryId: existing.deliveryId, status: existing.status, updatedAt: existing.updatedAt },
      data: { status: "SKIPPED", reason: "RETRY_KEY_EXPIRED" },
    });
    if (count !== 1) return "alreadyHandled";
    logger.warn("[ReminderService] Retry key expired; reminder not retried.", {
      kind: candidate.kind,
      previousReason: existing.reason,
      userId: hashIdentifier(candidate.userId),
    });
    return "skipped";
  }

  const deliveryId = await claimDelivery(candidate, existing, now);
  if (!deliveryId) return "alreadyHandled";

  let result: LineNotificationResult;
  try {
    result = await candidate.send(deliveryId);
  } catch {
    result = { sent: false, reason: "UNEXPECTED_ERROR" };
  }
  const outcome = deliveryOutcome(result);
  await prisma.notificationDelivery.update({
    where: { deliveryId },
    data: {
      status: outcome.status,
      reason: outcome.reason,
      ...(outcome.status === "SENT" ? { sentAt: new Date() } : {}),
      ...(outcome.status === "FAILED" ? { attempts: { increment: 1 } } : {}),
    },
  });
  if (outcome.status === "FAILED") {
    logger.warn("[ReminderService] Reminder delivery failed.", {
      kind: candidate.kind,
      reason: outcome.reason,
      userId: hashIdentifier(candidate.userId),
    });
  }
  return outcome.status === "SENT" ? "sent" : outcome.status === "SKIPPED" ? "skipped" : "failed";
}

/**
 * Claims and sends the candidates, at most MAX_DELIVERIES_PER_RUN of them.
 * Rows that are already SENT/SKIPPED (or in flight elsewhere) are counted as
 * alreadyHandled without touching LINE.
 */
export async function deliverReminders(
  candidates: ReminderCandidate[],
  now: Date,
  limit = MAX_DELIVERIES_PER_RUN,
): Promise<ReminderSummary> {
  const summary: ReminderSummary = { considered: candidates.length, sent: 0, skipped: 0, failed: 0, alreadyHandled: 0 };
  const existing = await loadExistingDeliveries(candidates.map((candidate) => candidate.dedupKey));
  const pending: ReminderCandidate[] = [];
  for (const candidate of candidates) {
    if (isSettled(existing.get(candidate.dedupKey), candidate.kind, now)) summary.alreadyHandled += 1;
    else pending.push(candidate);
  }

  const batch = pending.slice(0, limit);
  if (pending.length > batch.length) {
    logger.warn("[ReminderService] Delivery limit reached; the rest waits for the next run.", {
      kind: candidates[0]?.kind,
      limit,
      deferred: pending.length - batch.length,
    });
  }

  let next = 0;
  const worker = async () => {
    while (next < batch.length) {
      const candidate = batch[next++];
      try {
        summary[await deliverOne(candidate, existing.get(candidate.dedupKey), now)] += 1;
      } catch (error) {
        // A database error on one row must not stop the rest of the run.
        summary.failed += 1;
        logger.error("[ReminderService] Could not record reminder delivery.", {
          kind: candidate.kind,
          userId: hashIdentifier(candidate.userId),
          error,
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, batch.length) }, worker));
  return summary;
}

/** "Class starts in 15 minutes" to every ACTIVE student of a running class. */
export async function sendClassSessionReminders(
  options: { now?: Date; leadMinutes?: number } = {},
): Promise<ReminderSummary> {
  const now = options.now ?? new Date();
  const leadMinutes = options.leadMinutes ?? DEFAULT_LEAD_MINUTES;

  const classes = await prisma.class.findMany({
    where: {
      isDemo: false,
      setupRequiredAt: null,
      status: { in: ["OPEN", "FULL"], mode: "insensitive" },
      scheduleData: { not: Prisma.DbNull },
      OR: [{ endsAt: null }, { endsAt: { gte: new Date(now.getTime() - ENDED_CLASS_GRACE_MS) } }],
    },
    select: {
      classId: true,
      title: true,
      scheduleData: true,
      startsAt: true,
      endsAt: true,
      enrollments: { where: { status: "ACTIVE" }, select: { studentUserId: true } },
    },
  });

  const candidates: (ReminderCandidate & { startsAt: number })[] = [];
  for (const cls of classes) {
    if (!cls.enrollments.length) continue;
    const due = sessionsDueForReminder(
      sessionStartsFromSchedule(cls.scheduleData, cls.startsAt, cls.endsAt, now),
      now,
      leadMinutes,
    );
    for (const session of due) {
      const { altText, card } = buildClassSessionReminderCard(cls.classId, cls.title, session, now);
      for (const { studentUserId } of cls.enrollments) {
        candidates.push({
          dedupKey: classSessionDedupKey(cls.classId, session, studentUserId),
          kind: "CLASS_SESSION_REMINDER",
          userId: studentUserId,
          classId: cls.classId,
          startsAt: session.startsAt.getTime(),
          send: (retryKey) =>
            LineNotificationService.sendFlexToUserWithResult(studentUserId, altText, card, {
              type: "notifyClassReminders",
              retryKey,
            }),
        });
      }
    }
  }
  candidates.sort((a, b) => a.startsAt - b.startsAt); // soonest first if the run is capped

  const summary = await deliverReminders(candidates, now);
  logger.info("[ReminderService] Class session reminders run.", {
    leadMinutes,
    classesScanned: classes.length,
    ...summary,
  });
  return summary;
}

/** Day 1/3/7 follow-ups for a book a tutor opened that the student has not paid for. */
export async function sendBookPaymentReminders(
  options: { now?: Date } = {},
): Promise<ReminderSummary> {
  const now = options.now ?? new Date();
  // Packages older than day 14 never get a reminder; one extra day absorbs the
  // Bangkok/UTC day boundary.
  const oldest = new Date(now.getTime() - (PAYMENT_REMINDER_LAST_DAY + 1) * DAY_MS);

  const packages = await prisma.enrollmentPackage.findMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { gte: oldest },
      enrollment: { status: "ACTIVE" },
      classBookCycle: { class: { NOT: { status: { equals: "CLOSED", mode: "insensitive" } } } },
    },
    select: {
      enrollmentPackageId: true,
      studentUserId: true,
      createdAt: true,
      classBookCycle: {
        select: {
          classBookCycleId: true,
          classId: true,
          book: { select: { title: true } },
          class: { select: { title: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const candidates: ReminderCandidate[] = [];
  for (const pkg of packages) {
    const milestone = paymentReminderMilestone(pkg.createdAt, now);
    if (milestone === null) continue;
    const cycle = pkg.classBookCycle;
    const text = buildBookPaymentReminderText({
      bookTitle: cycle.book.title,
      classTitle: cycle.class.title,
      classId: cycle.classId,
      cycleId: cycle.classBookCycleId,
    });
    candidates.push({
      dedupKey: bookPaymentDedupKey(pkg.enrollmentPackageId, milestone),
      kind: "BOOK_PAYMENT_REMINDER",
      userId: pkg.studentUserId,
      classId: cycle.classId,
      send: (retryKey) =>
        LineNotificationService.sendTextToUserWithResult(pkg.studentUserId, text, {
          type: "notifyClassReminders",
          retryKey,
        }),
    });
  }

  const summary = await deliverReminders(candidates, now);
  logger.info("[ReminderService] Book payment reminders run.", {
    packagesScanned: packages.length,
    ...summary,
  });
  return summary;
}
