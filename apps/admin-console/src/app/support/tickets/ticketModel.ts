/**
 * Pure helpers for /support/tickets (support ticket queue and detail):
 * API shapes (learning-service /v1/admin/tickets…), queue filters → query,
 * due-date state, thread view model, composer validation and payloads.
 * Relative imports only so vitest (whose "@" alias points elsewhere) can test it.
 * No i18n keys here: components map the returned codes to Thai copy.
 */

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER", "RESOLVED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

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

/** Queue tabs: ACTIVE = everything not RESOLVED (the backend default). */
export const STATUS_TABS = ["ACTIVE", "OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER", "RESOLVED"] as const;
export type StatusTab = (typeof STATUS_TABS)[number];
export const DEFAULT_STATUS_TAB: StatusTab = "ACTIVE";

export const ASSIGNEE_FILTERS = ["me", "unassigned"] as const;
export type AssigneeFilter = (typeof ASSIGNEE_FILTERS)[number];

export const REPLY_MAX = 4000;
export const STATUS_NOTE_MAX = 1000;
/** Due within this many ms (and not yet answered) → "soon" tone. */
export const DUE_SOON_MS = 24 * 60 * 60 * 1000;

export interface TicketPerson {
  userId: string;
  displayName: string | null;
}

export interface TicketRequester extends TicketPerson {
  role: "STUDENT" | "TUTOR" | string;
  email: string | null;
}

/** GET /v1/admin/tickets item. */
export interface AdminTicketSummary {
  ticketId: string;
  ticketNumber: number;
  category: TicketCategory | string;
  subject: string;
  status: TicketStatus | string;
  requester: TicketRequester;
  assignee: TicketPerson | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  dueAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  overdue: boolean;
  awaitingSupport: boolean;
}

export type AdminMessageKind = "MESSAGE" | "INTERNAL_NOTE" | "STATUS_CHANGE";

export interface AdminMessage {
  messageId: string;
  kind: AdminMessageKind | string;
  author: "REQUESTER" | "SUPPORT" | string;
  authorName: string | null;
  body: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
}

/** GET /v1/admin/tickets/:ticketId → { ticket }. */
export interface AdminTicketDetail extends AdminTicketSummary {
  classId: string | null;
  classTitle: string | null;
  paymentReference: string | null;
  messages: AdminMessage[];
}

export interface TicketCounts {
  ACTIVE: number;
  OPEN: number;
  IN_PROGRESS: number;
  WAITING_ON_REQUESTER: number;
  RESOLVED: number;
  overdue: number;
  awaitingSupport: number;
}

export interface AdminTicketsResponse {
  tickets: AdminTicketSummary[];
  total: number;
  page: number;
  pageSize: number;
  counts: TicketCounts;
}

export interface AdminTicketResponse {
  ticket: AdminTicketDetail;
}

/* ─── Cache keys ─────────────────────────────────────────────────────── */

export function ticketsListPrefix(adminId: string): string {
  return `${adminId}:tickets:list:`;
}

export function ticketDetailKey(adminId: string, ticketId: string): string {
  return `${adminId}:tickets:detail:${ticketId}`;
}

/* ─── Queue filters ──────────────────────────────────────────────────── */

export function parseStatusTab(value: string | null | undefined): StatusTab {
  return (STATUS_TABS as readonly string[]).includes(value ?? "") ? (value as StatusTab) : DEFAULT_STATUS_TAB;
}

export function parseCategory(value: string | null | undefined): TicketCategory | "" {
  return (TICKET_CATEGORIES as readonly string[]).includes(value ?? "") ? (value as TicketCategory) : "";
}

export function parseAssignee(value: string | null | undefined): AssigneeFilter | "" {
  return (ASSIGNEE_FILTERS as readonly string[]).includes(value ?? "") ? (value as AssigneeFilter) : "";
}

export interface QueueFilters {
  status?: string | null;
  category?: string | null;
  assignee?: string | null;
  overdue?: string | boolean | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
}

export interface QueueQuery {
  status: StatusTab;
  category?: TicketCategory;
  assignee?: AssigneeFilter;
  overdue?: "true";
  q?: string;
  page: number;
  pageSize: number;
}

/** URL filters → GET /v1/admin/tickets query (unknown values dropped, empty keys omitted). */
export function buildQueueQuery(filters: QueueFilters): QueueQuery {
  const query: QueueQuery = {
    status: parseStatusTab(filters.status),
    page: Math.max(1, Math.trunc(filters.page ?? 1) || 1),
    pageSize: Math.min(100, Math.max(1, Math.trunc(filters.pageSize ?? 20) || 20)),
  };
  const category = parseCategory(filters.category);
  if (category) query.category = category;
  const assignee = parseAssignee(filters.assignee);
  if (assignee) query.assignee = assignee;
  if (filters.overdue === true || filters.overdue === "true") query.overdue = "true";
  const q = (filters.q ?? "").trim();
  if (q) query.q = q;
  return query;
}

export function isQueueFiltered(query: QueueQuery): boolean {
  return query.status !== DEFAULT_STATUS_TAB || Boolean(query.category || query.assignee || query.overdue || query.q);
}

/** Count for a status tab (undefined while loading so the badge stays hidden). */
export function tabCount(counts: TicketCounts | undefined, tab: StatusTab): number | undefined {
  return counts ? (counts[tab] ?? 0) : undefined;
}

/* ─── Display helpers ────────────────────────────────────────────────── */

export function formatTicketNumber(ticketNumber: number | null | undefined): string {
  return ticketNumber == null ? "#–" : `#${ticketNumber}`;
}

/**
 * First-response deadline state:
 * - "resolved": closed, no deadline to show as urgent
 * - "answered": support already replied (firstResponseAt set)
 * - "overdue": unanswered and past dueAt (same rule as the backend)
 * - "soon": unanswered and due within 24h
 * - "pending": unanswered, due later
 */
export type DueState = "resolved" | "answered" | "overdue" | "soon" | "pending";

export function dueState(
  ticket: Pick<AdminTicketSummary, "status" | "dueAt" | "firstResponseAt" | "overdue">,
  now: Date = new Date(),
): DueState {
  if (ticket.status === "RESOLVED") return "resolved";
  if (ticket.firstResponseAt) return "answered";
  const due = Date.parse(ticket.dueAt);
  if (ticket.overdue || (Number.isFinite(due) && now.getTime() > due)) return "overdue";
  if (Number.isFinite(due) && due - now.getTime() <= DUE_SOON_MS) return "soon";
  return "pending";
}

/* ─── Thread ─────────────────────────────────────────────────────────── */

export type ThreadItemKind = "requester" | "support" | "internal" | "event";

export interface ThreadItem {
  id: string;
  kind: ThreadItemKind;
  authorName: string | null;
  body: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  /** STATUS_CHANGE by the requester (reopen by replying, or "ปิดคำร้อง"). */
  byRequester: boolean;
  createdAt: string;
}

export function threadItemKind(message: Pick<AdminMessage, "kind" | "author">): ThreadItemKind {
  if (message.kind === "STATUS_CHANGE") return "event";
  if (message.kind === "INTERNAL_NOTE") return "internal";
  return message.author === "REQUESTER" ? "requester" : "support";
}

/** Oldest first (stable for equal timestamps), each message tagged with its bubble style. */
export function buildThread(messages: readonly AdminMessage[]): ThreadItem[] {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((a, b) => Date.parse(a.message.createdAt) - Date.parse(b.message.createdAt) || a.index - b.index)
    .map(({ message }) => ({
      id: message.messageId,
      kind: threadItemKind(message),
      authorName: message.authorName,
      body: message.body,
      fromStatus: message.fromStatus,
      toStatus: message.toStatus,
      byRequester: message.author === "REQUESTER",
      createdAt: message.createdAt,
    }));
}

/* ─── Composer ───────────────────────────────────────────────────────── */

export interface ComposerDraft {
  body: string;
  internal: boolean;
  /** "" = keep the current status (public replies on OPEN move to IN_PROGRESS on the server). */
  status: string;
}

export type ComposerError = "EMPTY" | "TOO_LONG" | "INVALID_STATUS";

export function validateComposer(draft: ComposerDraft): ComposerError | null {
  const body = draft.body.trim();
  if (!body) return "EMPTY";
  if (body.length > REPLY_MAX) return "TOO_LONG";
  if (draft.status && !(TICKET_STATUSES as readonly string[]).includes(draft.status)) return "INVALID_STATUS";
  return null;
}

export interface MessagePayload {
  body: string;
  internal: boolean;
  clientMessageId: string;
  status?: TicketStatus;
}

/**
 * POST /v1/admin/tickets/:id/messages body. `status` is sent only when it
 * changes the ticket (same status would be a no-op anyway).
 */
/** A send whose outcome is unknown (network error / 5xx): the server may have stored it. */
export interface PendingAttempt {
  key: string;
  clientMessageId: string;
}

/** What the server would store for this draft; a retry may reuse its id only if this is unchanged. */
export function draftAttemptKey(draft: ComposerDraft, currentStatus: string): string {
  const { body, internal, status } = buildMessagePayload(draft, currentStatus, "");
  return JSON.stringify([body, internal, status ?? null]);
}

/**
 * Reuses the pending attempt's clientMessageId only for the identical draft,
 * so the server replays a retry instead of storing it twice. Any edit (text,
 * public/internal, status) is a new message with a new id; reusing the old id
 * would make the server answer with the earlier message and drop this one.
 */
export function clientMessageIdFor(
  pending: PendingAttempt | null,
  key: string,
  makeId: () => string = () => newClientMessageId(),
): string {
  return pending && pending.key === key ? pending.clientMessageId : makeId();
}

export function buildMessagePayload(draft: ComposerDraft, currentStatus: string, clientMessageId: string): MessagePayload {
  const payload: MessagePayload = { body: draft.body.trim(), internal: draft.internal, clientMessageId };
  if (draft.status && draft.status !== currentStatus && (TICKET_STATUSES as readonly string[]).includes(draft.status)) {
    payload.status = draft.status as TicketStatus;
  }
  return payload;
}

/** The status a public reply will leave the ticket in (mirrors the backend rule). */
export function statusAfterReply(currentStatus: string, draft: Pick<ComposerDraft, "internal" | "status">): string {
  if (draft.status && (TICKET_STATUSES as readonly string[]).includes(draft.status)) return draft.status;
  if (!draft.internal && currentStatus === "OPEN") return "IN_PROGRESS";
  return currentStatus;
}

/** Status buttons on the detail page: every other status, in workflow order. */
export function statusTargets(currentStatus: string): TicketStatus[] {
  return TICKET_STATUSES.filter((status) => status !== currentStatus);
}

/* ─── Assign ─────────────────────────────────────────────────────────── */

export interface AssignActions {
  /** Unassigned, or assigned to someone else (take over). */
  canAssignToMe: boolean;
  canUnassign: boolean;
  assignedToMe: boolean;
}

export function assignActions(assignee: TicketPerson | null, myUserId: string | null | undefined): AssignActions {
  const assignedToMe = Boolean(assignee && myUserId && assignee.userId === myUserId);
  return {
    canAssignToMe: Boolean(myUserId) && !assignedToMe,
    canUnassign: assignee !== null,
    assignedToMe,
  };
}

/* ─── Ids ────────────────────────────────────────────────────────────── */

type CryptoLike = { randomUUID?: () => string; getRandomValues?: <T extends Uint8Array>(array: T) => T };

/**
 * UUID v4 for `clientMessageId` (the backend validates it as a UUID, so no
 * non-UUID fallback like newIdempotencyKey's). Reuse the same id when the
 * admin retries a failed send; make a new one after a success.
 */
export function newClientMessageId(source: CryptoLike | undefined = globalThis.crypto as CryptoLike | undefined): string {
  if (source?.randomUUID) return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (source?.getRandomValues) source.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
