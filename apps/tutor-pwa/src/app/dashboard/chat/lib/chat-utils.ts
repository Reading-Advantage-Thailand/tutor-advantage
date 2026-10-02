import { formatRelativeDay, formatThaiDate, dayOffset, toDate, toDateKey, type DateInput } from "@/lib/format";
import type { ChatConversation, ChatMessage } from "./chat-types";

/** Consecutive messages from one sender closer than this are drawn as one group. */
export const MESSAGE_GROUP_GAP_MS = 5 * 60_000;

/** Conversation ids are UUIDs; anything else never reaches the backend. */
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidConversationId(id: string | null | undefined): id is string {
  return typeof id === "string" && ID_PATTERN.test(id);
}

/** Resource-cache keys (always tutor-scoped). */
export const chatKeys = {
  all: (tutorId: string) => `${tutorId}:chat:`,
  conversations: (tutorId: string) => `${tutorId}:chat:conversations`,
  room: (tutorId: string, conversationId: string) => `${tutorId}:chat:room:${conversationId}`,
};

/** Case-insensitive search over the conversation title and last message. */
export function filterConversations(conversations: ChatConversation[], query: string): ChatConversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return conversations;
  return conversations.filter(
    (conv) =>
      (conv.title || "").toLowerCase().includes(q) ||
      (conv.lastMessage?.content || "").toLowerCase().includes(q),
  );
}

/**
 * Server messages first, then local optimistic messages that are still
 * pending (same behaviour as before: temporary messages stay visible until
 * the send call resolves).
 */
export function mergeServerMessages(server: ChatMessage[], current: ChatMessage[] | undefined): ChatMessage[] {
  const pending = (current ?? []).filter((m) => m.pending);
  if (pending.length === 0) return server;
  return [...server, ...pending];
}

/** Messages in `next` that are new compared to `previous` and were sent by someone else. */
export function newIncomingMessages(previous: ChatMessage[] | undefined, next: ChatMessage[]): ChatMessage[] {
  if (!previous) return [];
  const seen = new Set(previous.map((m) => m.id));
  return next.filter((m) => !m.isOwn && !m.pending && !seen.has(m.id));
}

/** Preview line for the conversation list: "คุณ: …" for own messages, "ชื่อ: …" in groups. */
export function conversationPreview(conv: ChatConversation, youLabel: string): string | null {
  const last = conv.lastMessage;
  if (!last?.content) return null;
  const sender = last.sender?.trim();
  if (sender && (sender === youLabel || conv.type === "GROUP")) return `${sender}: ${last.content}`;
  return last.content;
}

/** Day separator label: วันนี้ / เมื่อวาน, "ศ. 25 ก.ย." this year, "25 ก.ย. 2568" otherwise. */
export function formatDaySeparator(input: DateInput, now: Date = new Date()): string {
  const date = toDate(input);
  if (!date) return "";
  const offset = dayOffset(date, now);
  if (offset === 0 || offset === -1) return formatRelativeDay(date, now);
  const sameYear = toDateKey(date).slice(0, 4) === toDateKey(now).slice(0, 4);
  return formatThaiDate(date, sameYear ? "weekdayShort" : "medium");
}

export type TimelineItem =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: ChatMessage;
      /** First bubble of a run from one sender (show the name in groups). */
      startsGroup: boolean;
      /** Last bubble of a run (show avatar + time, tail on the bubble). */
      endsGroup: boolean;
    };

/** Inserts day separators and marks sender runs for bubble grouping. */
export function buildTimeline(messages: ChatMessage[], now: Date = new Date()): TimelineItem[] {
  const items: TimelineItem[] = [];
  let lastDay = "";
  const sameRun = (a: ChatMessage | undefined, b: ChatMessage | undefined) => {
    if (!a || !b) return false;
    if (a.senderId !== b.senderId || a.isOwn !== b.isOwn) return false;
    if (toDateKey(a.time) !== toDateKey(b.time)) return false;
    const gap = Math.abs((toDate(b.time)?.getTime() ?? 0) - (toDate(a.time)?.getTime() ?? 0));
    return gap <= MESSAGE_GROUP_GAP_MS;
  };
  messages.forEach((message, index) => {
    const day = toDateKey(message.time);
    if (day && day !== lastDay) {
      items.push({ kind: "day", key: `day-${day}`, label: formatDaySeparator(message.time, now) });
      lastDay = day;
    }
    items.push({
      kind: "message",
      key: message.id,
      message,
      startsGroup: !sameRun(messages[index - 1], message),
      endsGroup: !sameRun(message, messages[index + 1]),
    });
  });
  return items;
}
