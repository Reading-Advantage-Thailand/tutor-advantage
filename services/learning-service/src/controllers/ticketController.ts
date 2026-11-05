import { hashIdentifier, logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma, Prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  computeDueAt,
  HOUR_MS,
  DAY_MS,
  isRequesterRole,
  isUuid,
  LIMITS,
  parseIdempotencyKey,
  planRequesterReply,
  toTicketDetail,
  toTicketSummary,
  validateCreateTicket,
  validateRequesterReply,
  type RequesterRole,
} from "../services/supportTickets";
import { notifyNewTicket } from "../services/ticketNotifications";

/*
 * Requester side of support tickets (student LIFF /support, tutor PWA
 * /dashboard/support). Only STUDENT and TUTOR accounts; a ticket is visible
 * only to its requester, and a foreign or malformed id is TICKET_NOT_FOUND so
 * existence is never revealed. Internal notes are never returned here.
 */

export function errorBody(req: AuthenticatedRequest, code: string, message: string) {
  return { error: { code, message, requestId: req.id } };
}

export class TicketError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** A conditional status update matched no row: another request moved the ticket first. */
export class TicketRaceError extends Error {}

const STATUS_RACE_ATTEMPTS = 3;

/** Runs `fn` in a transaction, re-running it when a conditional status update lost a race. */
export async function runTicketTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(fn);
    } catch (error) {
      if (!(error instanceof TicketRaceError) || attempt >= STATUS_RACE_ATTEMPTS) throw error;
    }
  }
}

/**
 * Locks the ticket row for the rest of the transaction and returns the time
 * taken after the lock, so every timestamp this write stores sorts after any
 * message a concurrent request committed first (and lastMessageAt never goes
 * backwards).
 */
export async function lockTicket(tx: Prisma.TransactionClient, ticketId: string): Promise<Date> {
  await tx.$queryRaw`SELECT 1 FROM "learning"."support_tickets" WHERE "ticket_id" = ${ticketId}::uuid FOR UPDATE`;
  return new Date();
}

/**
 * Serialises one requester's writes so the open-ticket, daily and hourly
 * limits (count, then insert) cannot be overrun by parallel requests.
 * Taken before any ticket row lock; admin writes never take it.
 */
export async function lockRequester(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`support-ticket-requester:${userId}`}::text))`;
}

/** P2002 on a unique key that includes `column` (snake_case; the camelCase field name also matches). */
export function isUniqueViolation(error: unknown, column: string) {
  const { code, meta } = (error ?? {}) as { code?: string; meta?: { target?: unknown } };
  if (code !== "P2002") return false;
  const target = String(meta?.target ?? "");
  const field = column.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
  return target.includes(column) || target.includes(field);
}

export function sendTicketError(req: AuthenticatedRequest, res: Response, error: unknown, context: string) {
  if (error instanceof TicketError) {
    return res.status(error.status).json(errorBody(req, error.code, error.message));
  }
  logger.error(`[SupportTickets] ${context} failed`, error);
  return res.status(500).json(errorBody(req, "INTERNAL_SERVER_ERROR", `${context} failed`));
}

function notFound(req: AuthenticatedRequest, res: Response) {
  return res.status(404).json(errorBody(req, "TICKET_NOT_FOUND", "Ticket not found"));
}

/** The caller as a requester, or null after answering 401/403. */
function requesterFrom(req: AuthenticatedRequest, res: Response): { userId: string; role: RequesterRole } | null {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json(errorBody(req, "UNAUTHORIZED", "Authentication required"));
    return null;
  }
  const role = req.user?.role;
  if (!isRequesterRole(role)) {
    res.status(403).json(errorBody(req, "FORBIDDEN", "Only students and tutors can use support tickets"));
    return null;
  }
  return { userId, role };
}

const requesterDetailInclude = {
  class: { select: { title: true } },
  messages: { where: { kind: { not: "INTERNAL_NOTE" } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.SupportTicketInclude;

async function loadRequesterTicket(ticketId: string, requesterUserId: string) {
  return prisma.supportTicket.findFirst({
    where: { ticketId, requesterUserId },
    include: requesterDetailInclude,
  });
}

type RequesterTicket = NonNullable<Awaited<ReturnType<typeof loadRequesterTicket>>>;

function detailBody(ticket: RequesterTicket, now = new Date()) {
  return { ticket: toTicketDetail(ticket, ticket.messages, now) };
}

async function respondWithDetail(res: Response, status: number, ticketId: string, userId: string) {
  const ticket = await loadRequesterTicket(ticketId, userId);
  if (!ticket) throw new TicketError(404, "TICKET_NOT_FOUND", "Ticket not found");
  return res.status(status).json(detailBody(ticket));
}

async function assertMessageRate(db: Prisma.TransactionClient, userId: string, now: Date) {
  const recentMessages = await db.supportTicketMessage.count({
    where: {
      authorUserId: userId,
      authorSide: "REQUESTER",
      kind: "MESSAGE",
      createdAt: { gte: new Date(now.getTime() - HOUR_MS) },
    },
  });
  if (recentMessages >= LIMITS.maxRequesterMessagesPerHour) {
    throw new TicketError(429, "TICKET_RATE_LIMITED", "Too many messages; please try again later");
  }
}

async function classAccessible(classId: string, userId: string, role: RequesterRole) {
  if (role === "STUDENT") {
    const enrollment = await prisma.enrollment.findFirst({
      where: { classId, studentUserId: userId },
      select: { enrollmentId: true },
    });
    return Boolean(enrollment);
  }
  const cls = await prisma.class.findFirst({ where: { classId, tutorUserId: userId }, select: { classId: true } });
  return Boolean(cls);
}

async function findTicketByIdempotencyKey(requesterUserId: string, idempotencyKey: string) {
  return prisma.supportTicket.findFirst({
    where: { requesterUserId, idempotencyKey },
    include: requesterDetailInclude,
  });
}

// GET /v1/tickets
export async function listMyTickets(req: AuthenticatedRequest, res: Response) {
  const actor = requesterFrom(req, res);
  if (!actor) return;
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { requesterUserId: actor.userId },
      orderBy: { lastMessageAt: "desc" },
      take: LIMITS.requesterListMax,
      include: {
        class: { select: { title: true } },
        messages: {
          where: { authorSide: "SUPPORT", kind: { in: ["MESSAGE", "STATUS_CHANGE"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { authorSide: true, kind: true, createdAt: true },
        },
      },
    });
    return res.status(200).json({ tickets: tickets.map((ticket) => toTicketSummary(ticket, ticket.messages)) });
  } catch (error) {
    return sendTicketError(req, res, error, "List tickets");
  }
}

// POST /v1/tickets
export async function createTicket(req: AuthenticatedRequest, res: Response) {
  const actor = requesterFrom(req, res);
  if (!actor) return;
  try {
    // A retried create (same idempotencyKey) answers with the first ticket,
    // before validation and limits, so a lost response never fails the retry.
    const replayKey = parseIdempotencyKey((req.body as { idempotencyKey?: unknown } | undefined)?.idempotencyKey);
    if (replayKey) {
      const existing = await findTicketByIdempotencyKey(actor.userId, replayKey);
      if (existing) return res.status(200).json(detailBody(existing));
    }

    const parsed = validateCreateTicket(req.body, actor.role);
    if (!parsed.ok) return res.status(400).json(errorBody(req, parsed.code, parsed.message));
    const input = parsed.value;

    if (input.classId && !(await classAccessible(input.classId, actor.userId, actor.role))) {
      return res.status(400).json(errorBody(req, "CLASS_NOT_ACCESSIBLE", "You are not part of this class"));
    }

    let ticket: RequesterTicket;
    let now = new Date();
    try {
      ticket = await prisma.$transaction(async (tx) => {
        await lockRequester(tx, actor.userId);
        now = new Date();
        const [unresolved, createdToday] = await Promise.all([
          tx.supportTicket.count({ where: { requesterUserId: actor.userId, status: { not: "RESOLVED" } } }),
          tx.supportTicket.count({
            where: { requesterUserId: actor.userId, createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
          }),
        ]);
        if (unresolved >= LIMITS.maxUnresolvedPerRequester) {
          throw new TicketError(429, "TOO_MANY_OPEN_TICKETS", "Too many open tickets; close or wait for one to be resolved");
        }
        if (createdToday >= LIMITS.maxCreatedPer24h) {
          throw new TicketError(429, "TICKET_RATE_LIMITED", "Too many tickets today; please try again later");
        }
        await assertMessageRate(tx, actor.userId, now);
        return tx.supportTicket.create({
        data: {
          requesterUserId: actor.userId,
          requesterRole: actor.role,
          category: input.category,
          subject: input.subject,
          status: "OPEN",
          awaitingSupport: true,
          classId: input.classId,
          paymentReference: input.paymentReference,
          idempotencyKey: input.idempotencyKey,
          dueAt: computeDueAt(now, input.category),
          requesterLastReadAt: now,
          lastMessageAt: now,
          createdAt: now,
          messages: {
            create: {
              authorUserId: actor.userId,
              authorSide: "REQUESTER",
              kind: "MESSAGE",
              body: input.body,
              createdAt: now,
            },
          },
        },
        include: requesterDetailInclude,
        });
      });
    } catch (error) {
      if (!isUniqueViolation(error, "idempotency_key")) throw error;
      const existing = await findTicketByIdempotencyKey(actor.userId, input.idempotencyKey);
      if (!existing) throw error;
      return res.status(200).json(detailBody(existing));
    }

    logger.info("[SupportTickets] Ticket created", {
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      requester: hashIdentifier(actor.userId),
    });
    notifyNewTicket(ticket);
    return res.status(201).json(detailBody(ticket, now));
  } catch (error) {
    return sendTicketError(req, res, error, "Create ticket");
  }
}

// GET /v1/tickets/:ticketId — also marks the thread read.
export async function getMyTicket(req: AuthenticatedRequest, res: Response) {
  const actor = requesterFrom(req, res);
  if (!actor) return;
  const { ticketId } = req.params;
  if (!isUuid(ticketId)) return notFound(req, res);
  try {
    const ticket = await loadRequesterTicket(ticketId, actor.userId);
    if (!ticket) return notFound(req, res);
    // Mark read only up to the newest message this response carries, so a
    // reply committed meanwhile stays unread. Raw SQL: reading is not a
    // change, so updated_at (Prisma @updatedAt) must not move, and the read
    // marker never moves backwards.
    const readUpTo = ticket.messages.reduce(
      (latest, message) => (message.createdAt > latest ? message.createdAt : latest),
      ticket.createdAt,
    );
    await prisma.$executeRaw`
      UPDATE "learning"."support_tickets"
         SET "requester_last_read_at" = GREATEST(COALESCE("requester_last_read_at", ${readUpTo}), ${readUpTo})
       WHERE "ticket_id" = ${ticketId}::uuid AND "requester_user_id" = ${actor.userId}::uuid`;
    const lastReadAt =
      ticket.requesterLastReadAt && ticket.requesterLastReadAt > readUpTo ? ticket.requesterLastReadAt : readUpTo;
    return res.status(200).json(detailBody({ ...ticket, requesterLastReadAt: lastReadAt }));
  } catch (error) {
    return sendTicketError(req, res, error, "Get ticket");
  }
}

// POST /v1/tickets/:ticketId/messages
export async function replyToMyTicket(req: AuthenticatedRequest, res: Response) {
  const actor = requesterFrom(req, res);
  if (!actor) return;
  const { ticketId } = req.params;
  if (!isUuid(ticketId)) return notFound(req, res);
  try {
    const owned = await prisma.supportTicket.findFirst({
      where: { ticketId, requesterUserId: actor.userId },
      select: { ticketId: true },
    });
    if (!owned) return notFound(req, res);

    const parsed = validateRequesterReply(req.body);
    if (!parsed.ok) return res.status(400).json(errorBody(req, parsed.code, parsed.message));
    const { body, clientMessageId } = parsed.value;

    const replayed = await prisma.supportTicketMessage.findFirst({
      where: { ticketId, clientMessageId },
      select: { messageId: true },
    });
    if (replayed) return respondWithDetail(res, 200, ticketId, actor.userId);

    try {
      await runTicketTransaction(async (tx) => {
        await lockRequester(tx, actor.userId);
        const now = await lockTicket(tx, ticketId);
        await assertMessageRate(tx, actor.userId, now);
        const current = await tx.supportTicket.findFirst({
          where: { ticketId, requesterUserId: actor.userId },
          select: { status: true, resolvedAt: true },
        });
        if (!current) throw new TicketError(404, "TICKET_NOT_FOUND", "Ticket not found");
        const plan = planRequesterReply(current, now);
        if (!plan.ok) throw new TicketError(409, "TICKET_CLOSED", "This ticket is closed; please open a new one");

        const updated = await tx.supportTicket.updateMany({
          where: { ticketId, status: current.status },
          data: {
            status: plan.nextStatus,
            awaitingSupport: true,
            lastMessageAt: now,
            requesterLastReadAt: now,
            ...(plan.clearResolvedAt ? { resolvedAt: null } : {}),
          },
        });
        if (updated.count !== 1) throw new TicketRaceError();

        if (plan.statusChanged) {
          await tx.supportTicketMessage.create({
            data: {
              ticketId,
              authorUserId: actor.userId,
              authorSide: "REQUESTER",
              kind: "STATUS_CHANGE",
              fromStatus: current.status,
              toStatus: plan.nextStatus,
              createdAt: now,
            },
          });
        }
        await tx.supportTicketMessage.create({
          data: {
            ticketId,
            authorUserId: actor.userId,
            authorSide: "REQUESTER",
            kind: "MESSAGE",
            body,
            clientMessageId,
            // The reopen marker sorts before the message that caused it.
            createdAt: plan.statusChanged ? new Date(now.getTime() + 1) : now,
          },
        });
      });
    } catch (error) {
      if (!isUniqueViolation(error, "client_message_id")) throw error;
      return respondWithDetail(res, 200, ticketId, actor.userId);
    }

    return respondWithDetail(res, 201, ticketId, actor.userId);
  } catch (error) {
    return sendTicketError(req, res, error, "Reply to ticket");
  }
}

// POST /v1/tickets/:ticketId/resolve
export async function resolveMyTicket(req: AuthenticatedRequest, res: Response) {
  const actor = requesterFrom(req, res);
  if (!actor) return;
  const { ticketId } = req.params;
  if (!isUuid(ticketId)) return notFound(req, res);
  try {
    await runTicketTransaction(async (tx) => {
      const now = await lockTicket(tx, ticketId);
      const current = await tx.supportTicket.findFirst({
        where: { ticketId, requesterUserId: actor.userId },
        select: { status: true },
      });
      if (!current) throw new TicketError(404, "TICKET_NOT_FOUND", "Ticket not found");
      if (current.status === "RESOLVED") return;

      const updated = await tx.supportTicket.updateMany({
        where: { ticketId, status: current.status },
        data: { status: "RESOLVED", resolvedAt: now, awaitingSupport: false, lastMessageAt: now, requesterLastReadAt: now },
      });
      if (updated.count !== 1) throw new TicketRaceError();
      await tx.supportTicketMessage.create({
        data: {
          ticketId,
          authorUserId: actor.userId,
          authorSide: "REQUESTER",
          kind: "STATUS_CHANGE",
          fromStatus: current.status,
          toStatus: "RESOLVED",
          createdAt: now,
        },
      });
    });
    return respondWithDetail(res, 200, ticketId, actor.userId);
  } catch (error) {
    return sendTicketError(req, res, error, "Resolve ticket");
  }
}
