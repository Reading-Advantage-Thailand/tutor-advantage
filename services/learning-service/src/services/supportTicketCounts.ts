import { prisma } from "@tutor-advantage/database";

/*
 * Badge counts for support tickets (notification summary, overdue digest).
 * Kept apart from the controllers so the summary endpoint can import them
 * without pulling in the ticket handlers.
 */

/**
 * The caller's tickets with a support reply or status change newer than
 * requesterLastReadAt (or any, when the requester never opened the ticket).
 * Same rule as TicketSummary.hasUnreadReply; it compares two columns, so it
 * is one SQL statement instead of a Prisma filter.
 */
export async function countSupportUpdates(userId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM "learning"."support_tickets" t
    WHERE t."requester_user_id" = ${userId}::uuid
      AND EXISTS (
        SELECT 1 FROM "learning"."support_ticket_messages" m
        WHERE m."ticket_id" = t."ticket_id"
          AND m."author_side" = 'SUPPORT'
          AND m."kind" IN ('MESSAGE', 'STATUS_CHANGE')
          AND (t."requester_last_read_at" IS NULL OR m."created_at" > t."requester_last_read_at")
      )`;
  return Number(rows[0]?.count ?? 0);
}

/** Unresolved tickets with no first response after their deadline. */
export function overdueTicketWhere(now: Date) {
  return { status: { not: "RESOLVED" }, firstResponseAt: null, dueAt: { lt: now } };
}

/** Unresolved tickets whose next move is the support team's. */
export const AWAITING_SUPPORT_WHERE = { status: { not: "RESOLVED" }, awaitingSupport: true };

export async function countOverdueAndAwaiting(now: Date) {
  const [overdue, awaitingSupport] = await Promise.all([
    prisma.supportTicket.count({ where: overdueTicketWhere(now) }),
    prisma.supportTicket.count({ where: AWAITING_SUPPORT_WHERE }),
  ]);
  return { overdue, awaitingSupport };
}
