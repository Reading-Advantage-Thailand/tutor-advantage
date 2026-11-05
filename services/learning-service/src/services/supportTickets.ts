/*
 * Support tickets: pure rules shared by the requester (/v1/tickets) and admin
 * (/v1/admin/tickets) controllers. No I/O here, so every rule is unit tested.
 *
 * Contract: categories per role, the first-response deadline (Bangkok business
 * days), status transitions, input validation and the response shapes.
 */

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

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER", "RESOLVED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type RequesterRole = "STUDENT" | "TUTOR";
export type AuthorSide = "REQUESTER" | "SUPPORT";
export type MessageKind = "MESSAGE" | "INTERNAL_NOTE" | "STATUS_CHANGE";

export const CATEGORIES_BY_ROLE: Record<RequesterRole, readonly TicketCategory[]> = {
  STUDENT: ["REFUND", "BOOK_DELIVERY", "BOOK_DAMAGED", "CLASS", "PRIVACY", "TECHNICAL", "OTHER"],
  TUTOR: ["BOOK_DELIVERY", "CLASS", "PAYOUT", "PRIVACY", "TECHNICAL", "OTHER"],
};

export const CATEGORY_LABELS_TH: Record<TicketCategory, string> = {
  REFUND: "คืนเงิน/ยกเลิก",
  BOOK_DELIVERY: "หนังสือยังไม่ได้รับ/ส่งช้า",
  BOOK_DAMAGED: "หนังสือชำรุด/ผิดเล่ม",
  CLASS: "คลาสเรียน/ตารางเรียน",
  PAYOUT: "การจ่ายเงินติวเตอร์",
  PRIVACY: "ข้อมูลส่วนตัว/ลบบัญชี",
  TECHNICAL: "ปัญหาการใช้งานแอป",
  OTHER: "อื่นๆ",
};

export const REQUESTER_ROLE_LABELS_TH: Record<RequesterRole, string> = {
  STUDENT: "นักเรียน",
  TUTOR: "ติวเตอร์",
};

export const LIMITS = {
  subjectMin: 3,
  subjectMax: 120,
  createBodyMin: 10,
  bodyMax: 4000,
  replyBodyMin: 1,
  statusNoteMax: 1000,
  paymentReferenceMax: 64,
  maxUnresolvedPerRequester: 5,
  maxCreatedPer24h: 10,
  maxRequesterMessagesPerHour: 30,
  reopenWindowDays: 14,
  requesterListMax: 100,
  adminPageSizeDefault: 20,
  adminPageSizeMax: 100,
  searchMax: 100,
} as const;

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
const BANGKOK_OFFSET_MS = 7 * HOUR_MS; // Thailand has no DST

// Any hex UUID (as adminClassController / finance accept).
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYMENT_REFERENCE_RE = /^[A-Za-z0-9_-]+$/;
const TICKET_NUMBER_RE = /^#?(\d{1,10})$/;
const MAX_INT4 = 2147483647;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

export function isTicketCategory(value: unknown): value is TicketCategory {
  return typeof value === "string" && (TICKET_CATEGORIES as readonly string[]).includes(value);
}

export function isRequesterRole(role: unknown): role is RequesterRole {
  return role === "STUDENT" || role === "TUTOR";
}

export function categoryAllowedForRole(category: unknown, role: RequesterRole): category is TicketCategory {
  return isTicketCategory(category) && CATEGORIES_BY_ROLE[role].includes(category);
}

/** Length in code points, as Postgres char_length counts (CHECK constraints). */
export function textLength(value: string): number {
  return [...value].length;
}

// ── First-response deadline ────────────────────────────────────────────────

/** Days since 1970-01-01 of the Bangkok calendar day that contains `instant`. */
function bangkokDayNumber(instant: Date): number {
  return Math.floor((instant.getTime() + BANGKOK_OFFSET_MS) / DAY_MS);
}

function isWeekendDayNumber(day: number): boolean {
  const weekday = new Date(day * DAY_MS).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function businessDaysFor(category: TicketCategory): number {
  return category === "REFUND" ? 3 : 2;
}

/**
 * End of day (23:59:59.999 Asia/Bangkok) of the Nth business day (Mon–Fri on
 * the Bangkok calendar) after the creation day: N = 3 for REFUND, else 2.
 * Public holidays are not modelled.
 */
export function computeDueAt(createdAt: Date, category: TicketCategory): Date {
  let day = bangkokDayNumber(createdAt);
  let remaining = businessDaysFor(category);
  while (remaining > 0) {
    day += 1;
    if (!isWeekendDayNumber(day)) remaining -= 1;
  }
  return new Date((day + 1) * DAY_MS - BANGKOK_OFFSET_MS - 1);
}

/** "6 พ.ย. 2569" — the Bangkok calendar date of `instant`, Thai style. */
export function formatBangkokDate(instant: Date): string {
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" }).format(instant);
}

// ── Ticket state rules ─────────────────────────────────────────────────────

export interface TicketState {
  status: string;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  dueAt: Date;
}

export function isOverdue(ticket: TicketState, now: Date): boolean {
  return ticket.status !== "RESOLVED" && ticket.firstResponseAt === null && now.getTime() > ticket.dueAt.getTime();
}

function resolvedWithinReopenWindow(resolvedAt: Date | null, now: Date): boolean {
  return resolvedAt !== null && now.getTime() - resolvedAt.getTime() <= LIMITS.reopenWindowDays * DAY_MS;
}

export function canReply(ticket: Pick<TicketState, "status" | "resolvedAt">, now: Date): boolean {
  return ticket.status !== "RESOLVED" || resolvedWithinReopenWindow(ticket.resolvedAt, now);
}

export type RequesterReplyPlan =
  | { ok: true; nextStatus: TicketStatus; statusChanged: boolean; clearResolvedAt: boolean }
  | { ok: false; code: "TICKET_CLOSED" };

/**
 * What a requester message does to the ticket: WAITING_ON_REQUESTER → OPEN;
 * RESOLVED within the reopen window → OPEN (resolvedAt cleared); RESOLVED
 * longer ago → TICKET_CLOSED. OPEN / IN_PROGRESS keep their status.
 */
export function planRequesterReply(ticket: Pick<TicketState, "status" | "resolvedAt">, now: Date): RequesterReplyPlan {
  if (ticket.status === "RESOLVED") {
    if (!resolvedWithinReopenWindow(ticket.resolvedAt, now)) return { ok: false, code: "TICKET_CLOSED" };
    return { ok: true, nextStatus: "OPEN", statusChanged: true, clearResolvedAt: true };
  }
  if (ticket.status === "WAITING_ON_REQUESTER") {
    return { ok: true, nextStatus: "OPEN", statusChanged: true, clearResolvedAt: false };
  }
  return { ok: true, nextStatus: ticket.status as TicketStatus, statusChanged: false, clearResolvedAt: false };
}

/**
 * Column changes when support moves a ticket to `to`. RESOLVED stamps
 * resolvedAt, leaving RESOLVED clears it. WAITING_ON_REQUESTER and RESOLVED
 * hand the ticket to the requester (awaitingSupport=false); an admin reopen
 * to OPEN puts it back in the support queue. IN_PROGRESS leaves the flag.
 */
export function supportStatusChange(
  from: string,
  to: TicketStatus,
  now: Date,
): { resolvedAt?: Date | null; awaitingSupport?: boolean } {
  const data: { resolvedAt?: Date | null; awaitingSupport?: boolean } = {};
  if (to === "RESOLVED") data.resolvedAt = now;
  else if (from === "RESOLVED") data.resolvedAt = null;
  if (to === "WAITING_ON_REQUESTER" || to === "RESOLVED") data.awaitingSupport = false;
  else if (to === "OPEN") data.awaitingSupport = true;
  return data;
}

/**
 * Status after an admin message: an explicit status wins; otherwise a public
 * reply moves OPEN → IN_PROGRESS. Internal notes never move it on their own.
 */
export function adminMessageNextStatus(current: string, internal: boolean, explicit: TicketStatus | null): string {
  if (explicit) return explicit;
  if (!internal && current === "OPEN") return "IN_PROGRESS";
  return current;
}

/** Statuses that trigger the requester's LINE notification. */
export function notifiesRequester(status: string): boolean {
  return status === "WAITING_ON_REQUESTER" || status === "RESOLVED";
}

// ── Validation ─────────────────────────────────────────────────────────────

export type ValidationErrorCode = "VALIDATION_FAILED" | "INVALID_CATEGORY";
export type Validated<T> = { ok: true; value: T } | { ok: false; code: ValidationErrorCode; message: string };

function fail(message: string, code: ValidationErrorCode = "VALIDATION_FAILED"): { ok: false; code: ValidationErrorCode; message: string } {
  return { ok: false, code, message };
}

function asRecord(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

/**
 * NUL and other C0/C1 control characters (except tab, newline, carriage
 * return). Postgres text columns reject U+0000 outright, so letting it through
 * would turn a bad request into a 500.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

export function hasControlChars(value: string): boolean {
  return CONTROL_CHARS.test(value);
}

function trimmedText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string" || hasControlChars(value)) return null;
  const text = value.trim();
  const length = textLength(text);
  return length >= min && length <= max ? text : null;
}

export function parseIdempotencyKey(value: unknown): string | null {
  return isUuid(value) ? value.toLowerCase() : null;
}

export interface CreateTicketInput {
  category: TicketCategory;
  subject: string;
  body: string;
  classId: string | null;
  paymentReference: string | null;
  idempotencyKey: string;
}

export function validateCreateTicket(raw: unknown, role: RequesterRole): Validated<CreateTicketInput> {
  const body = asRecord(raw);
  if (!body) return fail("Request body must be an object");

  const idempotencyKey = parseIdempotencyKey(body.idempotencyKey);
  if (!idempotencyKey) return fail("idempotencyKey must be a UUID");

  if (!categoryAllowedForRole(body.category, role)) {
    return fail("category is not available for this account", "INVALID_CATEGORY");
  }

  const subject = trimmedText(body.subject, LIMITS.subjectMin, LIMITS.subjectMax);
  if (subject === null) return fail(`subject must be ${LIMITS.subjectMin}-${LIMITS.subjectMax} characters`);

  const text = trimmedText(body.body, LIMITS.createBodyMin, LIMITS.bodyMax);
  if (text === null) return fail(`body must be ${LIMITS.createBodyMin}-${LIMITS.bodyMax} characters`);

  let classId: string | null = null;
  if (body.classId !== undefined && body.classId !== null && body.classId !== "") {
    if (!isUuid(body.classId)) return fail("classId must be a UUID");
    classId = body.classId.toLowerCase();
  }

  let paymentReference: string | null = null;
  if (body.paymentReference !== undefined && body.paymentReference !== null) {
    if (typeof body.paymentReference !== "string") return fail("paymentReference must be a string");
    const ref = body.paymentReference.trim();
    if (ref) {
      if (ref.length > LIMITS.paymentReferenceMax || !PAYMENT_REFERENCE_RE.test(ref)) {
        return fail(`paymentReference must be 1-${LIMITS.paymentReferenceMax} letters, digits, _ or -`);
      }
      paymentReference = ref;
    }
  }

  return { ok: true, value: { category: body.category, subject, body: text, classId, paymentReference, idempotencyKey } };
}

export interface ReplyInput {
  body: string;
  clientMessageId: string;
}

export function validateRequesterReply(raw: unknown): Validated<ReplyInput> {
  const body = asRecord(raw);
  if (!body) return fail("Request body must be an object");
  const clientMessageId = parseIdempotencyKey(body.clientMessageId);
  if (!clientMessageId) return fail("clientMessageId must be a UUID");
  const text = trimmedText(body.body, LIMITS.replyBodyMin, LIMITS.bodyMax);
  if (text === null) return fail(`body must be ${LIMITS.replyBodyMin}-${LIMITS.bodyMax} characters`);
  return { ok: true, value: { body: text, clientMessageId } };
}

export interface AdminMessageInput extends ReplyInput {
  internal: boolean;
  status: TicketStatus | null;
}

export function validateAdminMessage(raw: unknown): Validated<AdminMessageInput> {
  const reply = validateRequesterReply(raw);
  if (!reply.ok) return reply;
  const body = raw as Record<string, unknown>;
  if (typeof body.internal !== "boolean") return fail("internal must be a boolean");
  let status: TicketStatus | null = null;
  if (body.status !== undefined && body.status !== null) {
    if (!isTicketStatus(body.status)) return fail("status is not a ticket status");
    status = body.status;
  }
  return { ok: true, value: { ...reply.value, internal: body.internal, status } };
}

export interface AdminStatusInput {
  status: TicketStatus;
  note: string | null;
}

export function validateAdminStatus(raw: unknown): Validated<AdminStatusInput> {
  const body = asRecord(raw);
  if (!body) return fail("Request body must be an object");
  if (!isTicketStatus(body.status)) return fail("status is not a ticket status");
  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string" || hasControlChars(body.note)) return fail("note must be plain text");
    const text = body.note.trim();
    if (textLength(text) > LIMITS.statusNoteMax) return fail(`note must be at most ${LIMITS.statusNoteMax} characters`);
    note = text || null;
  }
  return { ok: true, value: { status: body.status, note } };
}

export function validateAssign(raw: unknown): Validated<{ assigneeUserId: string | null }> {
  const body = asRecord(raw);
  if (!body || !("assigneeUserId" in body)) return fail("assigneeUserId is required (string or null)");
  if (body.assigneeUserId === null) return { ok: true, value: { assigneeUserId: null } };
  if (!isUuid(body.assigneeUserId)) return fail("assigneeUserId must be a UUID or null");
  return { ok: true, value: { assigneeUserId: body.assigneeUserId.toLowerCase() } };
}

// ── Admin list query ───────────────────────────────────────────────────────

export type AdminStatusFilter = "ACTIVE" | TicketStatus;

export interface AdminListQuery {
  status: AdminStatusFilter;
  category: TicketCategory | null;
  ticketNumber: number | null;
  search: string | null;
  assignee: "me" | "unassigned" | null;
  overdue: boolean;
  page: number;
  pageSize: number;
}

function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInt(value: unknown, fallback: number, max: number): number {
  const raw = firstValue(value);
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function parseAdminListQuery(query: Record<string, unknown>): Validated<AdminListQuery> {
  const rawStatus = firstValue(query.status);
  let status: AdminStatusFilter = "ACTIVE";
  if (rawStatus !== undefined && rawStatus !== "") {
    if (rawStatus !== "ACTIVE" && !isTicketStatus(rawStatus)) return fail("status filter is not valid");
    status = rawStatus as AdminStatusFilter;
  }

  const rawCategory = firstValue(query.category);
  let category: TicketCategory | null = null;
  if (rawCategory !== undefined && rawCategory !== "") {
    if (!isTicketCategory(rawCategory)) return fail("category filter is not valid", "INVALID_CATEGORY");
    category = rawCategory;
  }

  const rawAssignee = firstValue(query.assignee);
  let assignee: AdminListQuery["assignee"] = null;
  if (rawAssignee !== undefined && rawAssignee !== "") {
    if (rawAssignee !== "me" && rawAssignee !== "unassigned") return fail("assignee must be me or unassigned");
    assignee = rawAssignee;
  }

  let ticketNumber: number | null = null;
  let search: string | null = null;
  const rawQ = firstValue(query.q);
  if (typeof rawQ === "string" && rawQ.trim()) {
    const q = rawQ.trim().slice(0, LIMITS.searchMax);
    const match = TICKET_NUMBER_RE.exec(q);
    if (match) {
      const n = Number(match[1]);
      // A number beyond int4 cannot exist; 0 matches nothing either way.
      ticketNumber = n <= MAX_INT4 ? n : 0;
    } else {
      search = q;
    }
  }

  return {
    ok: true,
    value: {
      status,
      category,
      ticketNumber,
      search,
      assignee,
      overdue: firstValue(query.overdue) === "true",
      page: positiveInt(query.page, 1, 100000),
      pageSize: positiveInt(query.pageSize, LIMITS.adminPageSizeDefault, LIMITS.adminPageSizeMax),
    },
  };
}

// ── Views ──────────────────────────────────────────────────────────────────

export interface TicketMessageRow {
  messageId: string;
  authorUserId: string;
  authorSide: string;
  kind: string;
  body: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: Date;
  author?: { displayName: string | null } | null;
}

export interface TicketRow extends TicketState {
  ticketId: string;
  ticketNumber: number;
  requesterUserId: string;
  requesterRole: string;
  category: string;
  subject: string;
  awaitingSupport: boolean;
  classId: string | null;
  paymentReference: string | null;
  assigneeUserId: string | null;
  requesterLastReadAt: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  class?: { title: string } | null;
}

export interface AdminTicketRow extends TicketRow {
  requester: { userId: string; displayName: string | null; role: string; email: string | null };
  assignee: { userId: string; displayName: string | null } | null;
}

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

/** A support reply or status change the requester has not seen yet. */
export function isUnreadSupportEntry(message: Pick<TicketMessageRow, "authorSide" | "kind" | "createdAt">, lastReadAt: Date | null): boolean {
  if (message.authorSide !== "SUPPORT") return false;
  if (message.kind !== "MESSAGE" && message.kind !== "STATUS_CHANGE") return false;
  return lastReadAt === null || message.createdAt.getTime() > lastReadAt.getTime();
}

export function hasUnreadReply(messages: Pick<TicketMessageRow, "authorSide" | "kind" | "createdAt">[], lastReadAt: Date | null): boolean {
  return messages.some((message) => isUnreadSupportEntry(message, lastReadAt));
}

/** `supportMessages`: at least the latest SUPPORT MESSAGE/STATUS_CHANGE (or all messages). */
export function toTicketSummary(
  ticket: TicketRow,
  supportMessages: Pick<TicketMessageRow, "authorSide" | "kind" | "createdAt">[],
) {
  return {
    ticketId: ticket.ticketId,
    ticketNumber: ticket.ticketNumber,
    category: ticket.category,
    subject: ticket.subject,
    status: ticket.status,
    classId: ticket.classId,
    classTitle: ticket.class?.title ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    hasUnreadReply: hasUnreadReply(supportMessages, ticket.requesterLastReadAt),
  };
}

function byCreatedAt(a: TicketMessageRow, b: TicketMessageRow) {
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/** Requester view: oldest first, internal notes dropped, no admin names. */
export function toRequesterMessage(message: TicketMessageRow) {
  return {
    messageId: message.messageId,
    kind: message.kind as "MESSAGE" | "STATUS_CHANGE",
    author: message.authorSide as AuthorSide,
    body: message.body,
    fromStatus: message.fromStatus,
    toStatus: message.toStatus,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toTicketDetail(ticket: TicketRow, messages: TicketMessageRow[], now: Date) {
  const visible = messages.filter((m) => m.kind !== "INTERNAL_NOTE").sort(byCreatedAt);
  return {
    ...toTicketSummary(ticket, visible),
    paymentReference: ticket.paymentReference,
    resolvedAt: iso(ticket.resolvedAt),
    canReply: canReply(ticket, now),
    messages: visible.map(toRequesterMessage),
  };
}

export function toAdminTicketSummary(ticket: AdminTicketRow, now: Date) {
  return {
    ticketId: ticket.ticketId,
    ticketNumber: ticket.ticketNumber,
    category: ticket.category,
    subject: ticket.subject,
    status: ticket.status,
    requester: {
      userId: ticket.requester.userId,
      displayName: ticket.requester.displayName ?? null,
      role: ticket.requesterRole,
      email: ticket.requester.email ?? null,
    },
    assignee: ticket.assignee ? { userId: ticket.assignee.userId, displayName: ticket.assignee.displayName ?? null } : null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    dueAt: ticket.dueAt.toISOString(),
    firstResponseAt: iso(ticket.firstResponseAt),
    resolvedAt: iso(ticket.resolvedAt),
    overdue: isOverdue(ticket, now),
    awaitingSupport: ticket.awaitingSupport,
  };
}

export function toAdminMessage(message: TicketMessageRow, ticket: AdminTicketRow) {
  const authorName =
    message.authorSide === "REQUESTER"
      ? ticket.requester.displayName ?? null
      : message.author?.displayName ?? null;
  return {
    messageId: message.messageId,
    kind: message.kind as MessageKind,
    author: message.authorSide as AuthorSide,
    authorName,
    body: message.body,
    fromStatus: message.fromStatus,
    toStatus: message.toStatus,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toAdminTicketDetail(ticket: AdminTicketRow, messages: TicketMessageRow[], now: Date) {
  return {
    ...toAdminTicketSummary(ticket, now),
    classId: ticket.classId,
    classTitle: ticket.class?.title ?? null,
    paymentReference: ticket.paymentReference,
    messages: [...messages].sort(byCreatedAt).map((m) => toAdminMessage(m, ticket)),
  };
}

// ── Notification copy (never quotes subject/body) ─────────────────────────

export type RequesterNotice = "REPLY" | "WAITING_ON_REQUESTER" | "RESOLVED";

export function requesterNoticeText(notice: RequesterNotice, ticketNumber: number, link: string): string {
  const headline =
    notice === "REPLY"
      ? `ทีมงานตอบคำร้อง #${ticketNumber} แล้ว`
      : notice === "WAITING_ON_REQUESTER"
        ? `ทีมงานต้องการข้อมูลเพิ่มเติมสำหรับคำร้อง #${ticketNumber}`
        : `คำร้อง #${ticketNumber} ปิดแล้ว`;
  return [headline, link ? `ดูรายละเอียด: ${link}` : ""].filter(Boolean).join("\n");
}

/** Which LINE notice an admin action sends, if any (a reply wins over a status). */
export function requesterNoticeFor(publicReply: boolean, statusChangedTo: string | null): RequesterNotice | null {
  if (publicReply) return "REPLY";
  if (statusChangedTo === "WAITING_ON_REQUESTER" || statusChangedTo === "RESOLVED") return statusChangedTo;
  return null;
}
