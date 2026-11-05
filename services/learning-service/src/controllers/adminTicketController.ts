import { Response } from "express";
import { prisma, Prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  adminMessageNextStatus,
  isUuid,
  parseAdminListQuery,
  requesterNoticeFor,
  supportStatusChange,
  TICKET_STATUSES,
  toAdminTicketDetail,
  toAdminTicketSummary,
  validateAdminMessage,
  validateAdminStatus,
  validateAssign,
  type AdminListQuery,
  type TicketStatus,
} from "../services/supportTickets";
import { AWAITING_SUPPORT_WHERE, overdueTicketWhere } from "../services/supportTicketCounts";
import { notifyRequester } from "../services/ticketNotifications";
import {
  errorBody,
  isUniqueViolation,
  lockTicket,
  runTicketTransaction,
  sendTicketError,
  TicketError,
  TicketRaceError,
} from "./ticketController";

/*
 * Admin console /support/tickets: the support queue, the full thread
 * (internal notes included), replies, status changes and assignment.
 * Status changes and assignment write a finance_mlm.audit_events row.
 */

const AUDIT_ENTITY = "SupportTicket";

const adminSummaryInclude = {
  requester: { select: { userId: true, displayName: true, role: true, email: true } },
  assignee: { select: { userId: true, displayName: true } },
  class: { select: { title: true } },
} satisfies Prisma.SupportTicketInclude;

const adminDetailInclude = {
  ...adminSummaryInclude,
  messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { displayName: true } } } },
} satisfies Prisma.SupportTicketInclude;

function adminFrom(req: AuthenticatedRequest, res: Response): string | null {
  if (!req.user?.userId) {
    res.status(401).json(errorBody(req, "UNAUTHORIZED", "Authentication required"));
    return null;
  }
  if (req.user.role !== "ADMIN") {
    res.status(403).json(errorBody(req, "FORBIDDEN", "Only admins can manage support tickets"));
    return null;
  }
  return req.user.userId;
}

function notFound(req: AuthenticatedRequest, res: Response) {
  return res.status(404).json(errorBody(req, "TICKET_NOT_FOUND", "Ticket not found"));
}

async function respondWithAdminDetail(res: Response, status: number, ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { ticketId }, include: adminDetailInclude });
  if (!ticket) throw new TicketError(404, "TICKET_NOT_FOUND", "Ticket not found");
  return res.status(status).json({ ticket: toAdminTicketDetail(ticket, ticket.messages, new Date()) });
}

export function buildAdminTicketWhere(query: AdminListQuery, adminUserId: string, now: Date): Prisma.SupportTicketWhereInput {
  const and: Prisma.SupportTicketWhereInput[] = [];
  and.push(query.status === "ACTIVE" ? { status: { not: "RESOLVED" } } : { status: query.status });
  if (query.category) and.push({ category: query.category });
  if (query.ticketNumber !== null) and.push({ ticketNumber: query.ticketNumber });
  if (query.search) {
    const contains = { contains: query.search, mode: "insensitive" as const };
    and.push({
      OR: [{ subject: contains }, { requester: { displayName: contains } }, { requester: { email: contains } }],
    });
  }
  if (query.assignee === "me") and.push({ assigneeUserId: adminUserId });
  if (query.assignee === "unassigned") and.push({ assigneeUserId: null });
  if (query.overdue) and.push(overdueTicketWhere(now));
  return { AND: and };
}

export function adminTicketOrderBy(status: AdminListQuery["status"]): Prisma.SupportTicketOrderByWithRelationInput[] {
  return status === "RESOLVED"
    ? [{ resolvedAt: "desc" }, { createdAt: "desc" }]
    : [{ dueAt: "asc" }, { createdAt: "asc" }];
}

// GET /v1/admin/tickets?status=&category=&q=&assignee=&overdue=&page=&pageSize=
export async function getAdminTickets(req: AuthenticatedRequest, res: Response) {
  const adminUserId = adminFrom(req, res);
  if (!adminUserId) return;
  const parsed = parseAdminListQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) return res.status(400).json(errorBody(req, parsed.code, parsed.message));
  const query = parsed.value;
  try {
    const now = new Date();
    const where = buildAdminTicketWhere(query, adminUserId, now);
    const [tickets, total, byStatus, overdue, awaitingSupport] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: adminTicketOrderBy(query.status),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: adminSummaryInclude,
      }),
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.supportTicket.count({ where: overdueTicketWhere(now) }),
      prisma.supportTicket.count({ where: AWAITING_SUPPORT_WHERE }),
    ]);

    // Tab badges: whole queue, independent of the current filters.
    const counts: Record<"ACTIVE" | TicketStatus | "overdue" | "awaitingSupport", number> = {
      ACTIVE: 0,
      OPEN: 0,
      IN_PROGRESS: 0,
      WAITING_ON_REQUESTER: 0,
      RESOLVED: 0,
      overdue,
      awaitingSupport,
    };
    for (const row of byStatus) {
      if ((TICKET_STATUSES as readonly string[]).includes(row.status)) {
        counts[row.status as TicketStatus] = row._count._all;
        if (row.status !== "RESOLVED") counts.ACTIVE += row._count._all;
      }
    }

    return res.status(200).json({
      tickets: tickets.map((ticket) => toAdminTicketSummary(ticket, now)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      counts,
    });
  } catch (error) {
    return sendTicketError(req, res, error, "List admin tickets");
  }
}

// GET /v1/admin/tickets/:ticketId
export async function getAdminTicket(req: AuthenticatedRequest, res: Response) {
  if (!adminFrom(req, res)) return;
  const { ticketId } = req.params;
  if (!isUuid(ticketId)) return notFound(req, res);
  try {
    return await respondWithAdminDetail(res, 200, ticketId);
  } catch (error) {
    return sendTicketError(req, res, error, "Get admin ticket");
  }
}

function statusAudit(
  tx: Prisma.TransactionClient,
  adminUserId: string,
  ticket: { ticketId: string; ticketNumber: number },
  fromStatus: string,
  toStatus: string,
  via: "status" | "message",
) {
  return tx.auditEvent.create({
    data: {
      actorId: adminUserId,
      action: "SUPPORT_TICKET_STATUS_CHANGE",
      entityType: AUDIT_ENTITY,
      entityId: ticket.ticketId,
      payload: { ticketNumber: ticket.ticketNumber, fromStatus, toStatus, via },
    },
  });
}

const notifySelect = { ticketId: true, ticketNumber: true, requesterUserId: true, requesterRole: true } as const;

// POST /v1/admin/tickets/:ticketId/messages  { body, internal, clientMessageId, status? }
export async function postAdminTicketMessage(req: AuthenticatedRequest, res: Response) {
  const adminUserId = adminFrom(req, res);
  if (!adminUserId) return;
  const { ticketId } = req.params;
  if (!isUuid(ticketId)) return notFound(req, res);
  try {
    const exists = await prisma.supportTicket.findUnique({ where: { ticketId }, select: { ticketId: true } });
    if (!exists) return notFound(req, res);

    const parsed = validateAdminMessage(req.body);
    if (!parsed.ok) return res.status(400).json(errorBody(req, parsed.code, parsed.message));
    const { body, internal, clientMessageId, status: explicitStatus } = parsed.value;

    const replayed = await prisma.supportTicketMessage.findFirst({
      where: { ticketId, clientMessageId },
      select: { messageId: true },
    });
    if (replayed) return await respondWithAdminDetail(res, 200, ticketId);

    let outcome: { ticket: { ticketId: string; ticketNumber: number; requesterUserId: string; requesterRole: string }; changedTo: string | null };
    try {
      outcome = await runTicketTransaction(async (tx) => {
        const now = await lockTicket(tx, ticketId);
        const current = await tx.supportTicket.findUnique({
          where: { ticketId },
          select: { ...notifySelect, status: true, firstResponseAt: true },
        });
        if (!current) throw new TicketError(404, "TICKET_NOT_FOUND", "Ticket not found");

        const next = adminMessageNextStatus(current.status, internal, explicitStatus);
        const statusChanged = next !== current.status;

        if (!internal || statusChanged) {
          const data: Prisma.SupportTicketUpdateManyMutationInput = { lastMessageAt: now };
          if (statusChanged) Object.assign(data, supportStatusChange(current.status, next as TicketStatus, now), { status: next });
          if (!internal) {
            // A public reply hands the ticket back to the requester.
            data.awaitingSupport = false;
            if (!current.firstResponseAt) data.firstResponseAt = now;
          }
          const updated = await tx.supportTicket.updateMany({ where: { ticketId, status: current.status }, data });
          if (updated.count !== 1) throw new TicketRaceError();
        }

        await tx.supportTicketMessage.create({
          data: {
            ticketId,
            authorUserId: adminUserId,
            authorSide: "SUPPORT",
            kind: internal ? "INTERNAL_NOTE" : "MESSAGE",
            body,
            clientMessageId,
            createdAt: now,
          },
        });
        if (statusChanged) {
          await tx.supportTicketMessage.create({
            data: {
              ticketId,
              authorUserId: adminUserId,
              authorSide: "SUPPORT",
              kind: "STATUS_CHANGE",
              fromStatus: current.status,
              toStatus: next,
              // After the reply that came with it.
              createdAt: new Date(now.getTime() + 1),
            },
          });
          await statusAudit(tx, adminUserId, current, current.status, next, "message");
        }
        return { ticket: current, changedTo: statusChanged ? next : null };
      });
    } catch (error) {
      if (!isUniqueViolation(error, "client_message_id")) throw error;
      return await respondWithAdminDetail(res, 200, ticketId);
    }

    const notice = requesterNoticeFor(!internal, outcome.changedTo);
    if (notice) notifyRequester(outcome.ticket, notice);
    return await respondWithAdminDetail(res, 201, ticketId);
  } catch (error) {
    return sendTicketError(req, res, error, "Post admin ticket message");
  }
}

// POST /v1/admin/tickets/:ticketId/status  { status, note? }
export async function setAdminTicketStatus(req: AuthenticatedRequest, res: Response) {
  const adminUserId = adminFrom(req, res);
  if (!adminUserId) return;
  const { ticketId } = req.params;
  if (!isUuid(ticketId)) return notFound(req, res);
  const parsed = validateAdminStatus(req.body);
  if (!parsed.ok) return res.status(400).json(errorBody(req, parsed.code, parsed.message));
  const { status, note } = parsed.value;
  try {
    const outcome = await runTicketTransaction(async (tx) => {
      const now = await lockTicket(tx, ticketId);
      const current = await tx.supportTicket.findUnique({ where: { ticketId }, select: { ...notifySelect, status: true } });
      if (!current) throw new TicketError(404, "TICKET_NOT_FOUND", "Ticket not found");
      if (current.status === status) return null;

      const updated = await tx.supportTicket.updateMany({
        where: { ticketId, status: current.status },
        data: { status, lastMessageAt: now, ...supportStatusChange(current.status, status, now) },
      });
      if (updated.count !== 1) throw new TicketRaceError();

      await tx.supportTicketMessage.create({
        data: {
          ticketId,
          authorUserId: adminUserId,
          authorSide: "SUPPORT",
          kind: "STATUS_CHANGE",
          fromStatus: current.status,
          toStatus: status,
          createdAt: now,
        },
      });
      if (note) {
        await tx.supportTicketMessage.create({
          data: {
            ticketId,
            authorUserId: adminUserId,
            authorSide: "SUPPORT",
            kind: "INTERNAL_NOTE",
            body: note,
            createdAt: new Date(now.getTime() + 1),
          },
        });
      }
      await statusAudit(tx, adminUserId, current, current.status, status, "status");
      return current;
    });

    if (outcome) {
      const notice = requesterNoticeFor(false, status);
      if (notice) notifyRequester(outcome, notice);
    }
    return await respondWithAdminDetail(res, 200, ticketId);
  } catch (error) {
    return sendTicketError(req, res, error, "Set admin ticket status");
  }
}

// POST /v1/admin/tickets/:ticketId/assign  { assigneeUserId: string | null }
export async function assignAdminTicket(req: AuthenticatedRequest, res: Response) {
  const adminUserId = adminFrom(req, res);
  if (!adminUserId) return;
  const { ticketId } = req.params;
  if (!isUuid(ticketId)) return notFound(req, res);
  const parsed = validateAssign(req.body);
  if (!parsed.ok) return res.status(400).json(errorBody(req, parsed.code, parsed.message));
  const { assigneeUserId } = parsed.value;
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { ticketId },
      select: { ticketId: true, ticketNumber: true, assigneeUserId: true },
    });
    if (!ticket) return notFound(req, res);

    if (assigneeUserId) {
      const assignee = await prisma.user.findUnique({
        where: { userId: assigneeUserId },
        select: { role: true, isActive: true },
      });
      if (!assignee || assignee.role !== "ADMIN" || !assignee.isActive) {
        return res.status(400).json(errorBody(req, "INVALID_ASSIGNEE", "Assignee must be an active admin"));
      }
    }

    if (ticket.assigneeUserId !== assigneeUserId) {
      await prisma.$transaction(async (tx) => {
        await tx.supportTicket.update({ where: { ticketId }, data: { assigneeUserId } });
        await tx.auditEvent.create({
          data: {
            actorId: adminUserId,
            action: "SUPPORT_TICKET_ASSIGN",
            entityType: AUDIT_ENTITY,
            entityId: ticketId,
            payload: {
              ticketNumber: ticket.ticketNumber,
              fromAssigneeUserId: ticket.assigneeUserId,
              toAssigneeUserId: assigneeUserId,
            },
          },
        });
      });
    }
    return await respondWithAdminDetail(res, 200, ticketId);
  } catch (error) {
    return sendTicketError(req, res, error, "Assign admin ticket");
  }
}
