/**
 * Support tickets ("คำร้องของฉัน"): response types from learning-service
 * (GET/POST /v1/tickets…) and the pure display rules of the list and thread.
 *
 * Relative imports on purpose: the root vitest config maps "@" to tutor-pwa.
 */
import { formatRelativeDay, toDate, toLocalDateKey } from "../../../lib/format";
import type { I18nKey } from "../../../lib/i18n";

export const TICKET_CATEGORIES = [
  "REFUND",
  "BOOK_DELIVERY",
  "BOOK_DAMAGED",
  "CLASS",
  "PAYOUT",
  "PRIVACY",
  "TECHNICAL",
  "OTHER",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/** Categories a STUDENT may open (server rejects the rest with INVALID_CATEGORY). Display order. */
export const STUDENT_TICKET_CATEGORIES = [
  "REFUND",
  "BOOK_DELIVERY",
  "BOOK_DAMAGED",
  "CLASS",
  "PRIVACY",
  "TECHNICAL",
  "OTHER",
] as const satisfies readonly TicketCategory[];
export type StudentTicketCategory = (typeof STUDENT_TICKET_CATEGORIES)[number];

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER", "RESOLVED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface TicketSummary {
  ticketId: string;
  ticketNumber: number;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  classId: string | null;
  classTitle: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  hasUnreadReply: boolean;
}

export interface TicketMessage {
  messageId: string;
  kind: "MESSAGE" | "STATUS_CHANGE";
  author: "REQUESTER" | "SUPPORT";
  body: string | null;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  paymentReference: string | null;
  resolvedAt: string | null;
  canReply: boolean;
  messages: TicketMessage[];
}

export interface TicketsResponse {
  tickets: TicketSummary[];
}

export interface TicketResponse {
  ticket: TicketDetail;
}

export function isStudentCategory(value: unknown): value is StudentTicketCategory {
  return typeof value === "string" && (STUDENT_TICKET_CATEGORIES as readonly string[]).includes(value);
}

function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

/** Thai label key of a category; unknown values read as "อื่นๆ". */
export function getCategoryLabelKey(category: string | null | undefined): I18nKey {
  const known = (TICKET_CATEGORIES as readonly string[]).includes(category ?? "") ? (category as TicketCategory) : "OTHER";
  return `support.category.${known}`;
}

export type TicketStatusTone = "info" | "brand" | "warning" | "success" | "neutral";

/** Chip tone + label for a ticket status (WAITING_ON_REQUESTER stands out: it needs the student). */
export function getStatusDisplay(status: string | null | undefined): { tone: TicketStatusTone; labelKey: I18nKey } {
  switch (status) {
    case "OPEN":
      return { tone: "info", labelKey: "support.status.OPEN" };
    case "IN_PROGRESS":
      return { tone: "brand", labelKey: "support.status.IN_PROGRESS" };
    case "WAITING_ON_REQUESTER":
      return { tone: "warning", labelKey: "support.status.WAITING_ON_REQUESTER" };
    case "RESOLVED":
      return { tone: "success", labelKey: "support.status.RESOLVED" };
    default:
      return { tone: "neutral", labelKey: "support.status.OPEN" };
  }
}

/** Human reference shown everywhere ("#123"). */
export function formatTicketNumber(ticketNumber: number | null | undefined): string {
  return typeof ticketNumber === "number" && Number.isFinite(ticketNumber) ? `#${ticketNumber}` : "";
}

export type TicketTab = "open" | "closed";

export function isTicketClosed(ticket: Pick<TicketSummary, "status">): boolean {
  return ticket.status === "RESOLVED";
}

function timeOf(input: string | null | undefined): number {
  return toDate(input)?.getTime() ?? 0;
}

/** Newest activity first (the server already sorts; this keeps local updates in order). */
export function sortTickets<T extends Pick<TicketSummary, "lastMessageAt" | "ticketNumber">>(tickets: readonly T[]): T[] {
  return [...tickets].sort(
    (a, b) => timeOf(b.lastMessageAt) - timeOf(a.lastMessageAt) || (b.ticketNumber ?? 0) - (a.ticketNumber ?? 0),
  );
}

/** Open (anything not RESOLVED) and closed tickets, each newest first. */
export function splitTickets(tickets: readonly TicketSummary[] | null | undefined): {
  open: TicketSummary[];
  closed: TicketSummary[];
} {
  const sorted = sortTickets(tickets ?? []);
  return {
    open: sorted.filter((ticket) => !isTicketClosed(ticket)),
    closed: sorted.filter(isTicketClosed),
  };
}

export function countUnread(tickets: readonly TicketSummary[] | null | undefined): number {
  return (tickets ?? []).filter((ticket) => ticket.hasUnreadReply).length;
}

/** The tab to open on: "open" unless only the closed tab has something unread. */
export function getInitialTab(tickets: readonly TicketSummary[] | null | undefined): TicketTab {
  const { open, closed } = splitTickets(tickets);
  if (countUnread(open) === 0 && countUnread(closed) > 0) return "closed";
  return "open";
}

/** The list fields of a ticket detail (to refresh the cached list after a reply/resolve). */
export function toTicketSummary(detail: TicketDetail): TicketSummary {
  return {
    ticketId: detail.ticketId,
    ticketNumber: detail.ticketNumber,
    category: detail.category,
    subject: detail.subject,
    status: detail.status,
    classId: detail.classId,
    classTitle: detail.classTitle,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    lastMessageAt: detail.lastMessageAt,
    hasUnreadReply: detail.hasUnreadReply,
  };
}

/**
 * Cached list with this ticket replaced (or added on top) by the given detail.
 * Returns `list` unchanged when there is no cached list yet (the next visit loads it).
 */
export function upsertTicketSummary(
  list: TicketsResponse | undefined,
  detail: TicketDetail,
  { markRead = true }: { markRead?: boolean } = {},
): TicketsResponse | undefined {
  if (!list || !Array.isArray(list.tickets)) return list;
  const summary = { ...toTicketSummary(detail), ...(markRead ? { hasUnreadReply: false } : null) };
  const rest = list.tickets.filter((ticket) => ticket.ticketId !== summary.ticketId);
  return { ...list, tickets: sortTickets([summary, ...rest]) };
}

/** Clear the unread dot of one ticket (opening it marks it read on the server). Same object when nothing changes. */
export function markTicketRead(list: TicketsResponse | undefined, ticketId: string): TicketsResponse | undefined {
  if (!list || !Array.isArray(list.tickets)) return list;
  if (!list.tickets.some((ticket) => ticket.ticketId === ticketId && ticket.hasUnreadReply)) return list;
  return {
    ...list,
    tickets: list.tickets.map((ticket) => (ticket.ticketId === ticketId ? { ...ticket, hasUnreadReply: false } : ticket)),
  };
}

/* ─── Thread ───────────────────────────────────────────────────────────── */

export interface StatusEventCopy {
  labelKey: I18nKey;
  /** Status label shown after `labelKey` ("สถานะเปลี่ยนเป็น" + "กำลังดำเนินการ"). */
  statusLabelKey?: I18nKey;
}

/** One small centered line for a STATUS_CHANGE event. */
export function getStatusEventCopy(message: Pick<TicketMessage, "author" | "fromStatus" | "toStatus">): StatusEventCopy {
  if (message.toStatus === "RESOLVED") {
    return {
      labelKey: message.author === "REQUESTER" ? "support.statusEventResolvedByYou" : "support.statusEventResolvedBySupport",
    };
  }
  if (message.fromStatus === "RESOLVED" && message.toStatus === "OPEN") {
    return { labelKey: "support.statusEventReopened" };
  }
  return {
    labelKey: "support.statusEventChanged",
    statusLabelKey: isTicketStatus(message.toStatus) ? getStatusDisplay(message.toStatus).labelKey : undefined,
  };
}

export type ThreadItem =
  | { kind: "date"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: TicketMessage;
      /** REQUESTER = the student (right), SUPPORT = the team (left). */
      own: boolean;
      /** First bubble of a run from the same side (shows the "ทีมงาน" name, larger gap). */
      isFirstInGroup: boolean;
    }
  | { kind: "status"; key: string; message: TicketMessage; copy: StatusEventCopy };

/**
 * Thread rows oldest first: a date line whenever the local day changes, bubbles
 * for messages (empty bodies skipped), centered lines for status changes.
 */
export function buildThreadItems(messages: readonly TicketMessage[] | null | undefined, now: Date = new Date()): ThreadItem[] {
  const sorted = [...(messages ?? [])].sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
  const items: ThreadItem[] = [];
  let lastDay: string | null = null;
  let previousSide: TicketMessage["author"] | null = null;

  for (const message of sorted) {
    if (message.kind === "MESSAGE" && !message.body?.trim()) continue;
    if (message.kind !== "MESSAGE" && message.kind !== "STATUS_CHANGE") continue;

    const day = toDate(message.createdAt) ? toLocalDateKey(message.createdAt) : "";
    if (day && day !== lastDay) {
      items.push({ kind: "date", key: `date:${day}`, label: formatRelativeDay(message.createdAt, now) });
      lastDay = day;
      previousSide = null;
    }

    if (message.kind === "STATUS_CHANGE") {
      items.push({ kind: "status", key: message.messageId, message, copy: getStatusEventCopy(message) });
      previousSide = null;
      continue;
    }

    items.push({
      kind: "message",
      key: message.messageId,
      message,
      own: message.author === "REQUESTER",
      isFirstInGroup: previousSide !== message.author,
    });
    previousSide = message.author;
  }
  return items;
}

/** Id of the newest MESSAGE or STATUS_CHANGE (drives auto-scroll). */
export function getLastMessageId(messages: readonly TicketMessage[] | null | undefined): string | null {
  const sorted = [...(messages ?? [])].sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
  return sorted.length > 0 ? sorted[sorted.length - 1].messageId : null;
}
