import type { Tone } from "@/components/app";
import { t } from "@/lib/i18n";

/**
 * Support tickets ("คำร้อง/ติดต่อทีมงาน"): shared types and pure helpers for
 * the list, new-ticket form and thread. Plain module (no hooks, no server
 * imports) so pages, client components and tests can all use it. Shapes
 * follow learning-service `/v1/tickets` (requester view).
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

/** Categories a TUTOR may open (learning-service rejects the rest with INVALID_CATEGORY). */
export const TUTOR_TICKET_CATEGORIES: readonly TicketCategory[] = [
  "BOOK_DELIVERY",
  "CLASS",
  "PAYOUT",
  "PRIVACY",
  "TECHNICAL",
  "OTHER",
];

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER", "RESOLVED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const BODY_MIN = 10;
export const BODY_MAX = 4000;
export const REPLY_MAX = 4000;

/** Polling interval of an open ticket thread (visibility-aware). */
export const TICKET_POLL_MS = 20_000;

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

/** Option of the "related class" select (one of the tutor's classes). */
export interface SupportClassOption {
  value: string;
  label: string;
}

export interface CreateTicketRequest {
  category: TicketCategory;
  subject: string;
  body: string;
  classId?: string;
  idempotencyKey: string;
}

/** Ticket ids (and idempotency keys) are UUIDs; anything else never reaches the backend. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidTicketId(id: string | null | undefined): id is string {
  return typeof id === "string" && UUID_PATTERN.test(id);
}

/** Random v4 UUID for idempotency keys / client message ids (randomUUID needs a secure context). */
export function createClientId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isTicketCategory(value: unknown): value is TicketCategory {
  return typeof value === "string" && (TICKET_CATEGORIES as readonly string[]).includes(value);
}

export function isTutorCategory(value: unknown): value is TicketCategory {
  return typeof value === "string" && (TUTOR_TICKET_CATEGORIES as readonly string[]).includes(value);
}

export function categoryLabel(category: string | null | undefined): string {
  return isTicketCategory(category) ? t(`dashboardSupport.categories.${category}`) : t("dashboardSupport.categories.OTHER");
}

export function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case "OPEN":
    case "IN_PROGRESS":
    case "WAITING_ON_REQUESTER":
    case "RESOLVED":
      return t(`dashboardSupport.statuses.${status}`);
    default:
      return status ?? "–";
  }
}

/** Chip tone: waiting on the tutor stands out, closed is neutral. */
export function statusToneFor(status: string | null | undefined): Tone {
  switch (status) {
    case "OPEN":
      return "info";
    case "IN_PROGRESS":
      return "brand";
    case "WAITING_ON_REQUESTER":
      return "warning";
    default:
      return "neutral";
  }
}

export function formatTicketNumber(ticketNumber: number | null | undefined): string {
  return typeof ticketNumber === "number" && Number.isFinite(ticketNumber) ? `#${ticketNumber}` : "#–";
}

export interface TicketDraft {
  category: string;
  classId: string;
  subject: string;
  body: string;
}

export type TicketDraftErrors = Partial<Record<"category" | "subject" | "body", string>>;

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

/** Client-side checks mirroring learning-service limits (the server re-validates). */
export function validateTicketDraft(draft: TicketDraft): TicketDraftErrors {
  const errors: TicketDraftErrors = {};
  if (!isTutorCategory(draft.category)) errors.category = t("dashboardSupport.errorCategory");
  const subject = draft.subject.trim();
  if (subject.length < SUBJECT_MIN || subject.length > SUBJECT_MAX) {
    errors.subject = fill(t("dashboardSupport.errorSubject"), { min: SUBJECT_MIN, max: SUBJECT_MAX });
  }
  const body = draft.body.trim();
  if (body.length < BODY_MIN || body.length > BODY_MAX) {
    errors.body = fill(t("dashboardSupport.errorBody"), { min: BODY_MIN, max: BODY_MAX });
  }
  return errors;
}

/** Trimmed request body; classId only when it is a real id. */
export function buildCreateTicketRequest(draft: TicketDraft, idempotencyKey: string): CreateTicketRequest {
  const request: CreateTicketRequest = {
    category: draft.category as TicketCategory,
    subject: draft.subject.trim(),
    body: draft.body.trim(),
    idempotencyKey,
  };
  if (isValidTicketId(draft.classId)) request.classId = draft.classId;
  return request;
}

/** Error text for a reply, or null when it can be sent. */
export function validateReply(body: string): string | null {
  const text = body.trim();
  if (!text) return t("dashboardSupport.replyEmpty");
  if (text.length > REPLY_MAX) return fill(t("dashboardSupport.replyTooLong"), { max: REPLY_MAX });
  return null;
}

export function bodyHint(length: number): string {
  return fill(t("dashboardSupport.bodyHint"), { min: BODY_MIN, max: BODY_MAX, count: length });
}

/** Thai copy for an API error code (learning-service `error.code`). */
export function getSupportErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "VALIDATION_FAILED":
    case "INVALID_CATEGORY":
    case "CLASS_NOT_ACCESSIBLE":
    case "TOO_MANY_OPEN_TICKETS":
    case "TICKET_RATE_LIMITED":
    case "TICKET_NOT_FOUND":
    case "TICKET_CLOSED":
    case "FORBIDDEN":
    case "UNAUTHORIZED":
      return t(`dashboardSupport.errors.${code}`);
    default:
      return t("dashboardSupport.errors.fallback");
  }
}

/** Centered system line for a STATUS_CHANGE message. */
export function statusChangeText(message: Pick<TicketMessage, "toStatus">): string {
  return fill(t("dashboardSupport.statusChanged"), { status: statusLabel(message.toStatus) });
}

/** Banner for the thread header, or null for a normal open ticket. */
export function ticketStateNotice(
  ticket: Pick<TicketDetail, "status" | "canReply">,
): { tone: "warning" | "info" | "neutral"; text: string } | null {
  if (!ticket.canReply) return { tone: "neutral", text: t("dashboardSupport.closedNotice") };
  if (ticket.status === "RESOLVED") return { tone: "info", text: t("dashboardSupport.resolvedNotice") };
  if (ticket.status === "WAITING_ON_REQUESTER") return { tone: "warning", text: t("dashboardSupport.waitingNotice") };
  return null;
}

/** Active tickets first (as returned: newest activity first), resolved ones after. */
export function splitTickets<T extends Pick<TicketSummary, "status">>(tickets: T[]): { active: T[]; resolved: T[] } {
  return {
    active: tickets.filter((ticket) => ticket.status !== "RESOLVED"),
    resolved: tickets.filter((ticket) => ticket.status === "RESOLVED"),
  };
}

/** Prefill from `?category=&classId=` (ignored unless valid for a tutor). */
export function draftFromSearchParams(params: { category?: string | null; classId?: string | null }): Pick<TicketDraft, "category" | "classId"> {
  return {
    category: isTutorCategory(params.category) ? params.category : "",
    classId: isValidTicketId(params.classId) ? params.classId : "",
  };
}
