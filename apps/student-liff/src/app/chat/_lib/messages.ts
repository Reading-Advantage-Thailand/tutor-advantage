/**
 * Pure helpers for the chat room: merging polled server history with local
 * optimistic sends (no duplicated or dropped bubbles) and grouping messages
 * for display.
 *
 * Relative imports on purpose: the root vitest config maps "@" to tutor-pwa.
 */
import { formatRelativeDay, toLocalDateKey } from "../../../lib/format";

/** A message as GET /chat/conversations/:id/messages returns it. */
export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderImage?: string | null;
  time: string;
  isOwn: boolean;
}

export interface ConversationMetadata {
  id: string;
  title: string;
  image: string | null;
  fallbackIcon: string;
  status: string;
}

export interface ConversationPayload {
  metadata: ConversationMetadata;
  messages?: ChatMessage[] | null;
}

/** A message on screen: server history plus our own sends that the server list does not show yet. */
export interface DisplayMessage extends ChatMessage {
  /** Our optimistic message whose POST has not returned yet. */
  pending?: boolean;
}

/** A local send. It stays until the server history contains `serverId`. */
export interface OutboxEntry {
  /** "temp-…" id while the POST is in flight. */
  tempId: string;
  text: string;
  time: string;
  /** Message id from the POST response. */
  serverId?: string;
  serverTime?: string;
}

/** Optimistic ids keep the "temp-" prefix the page always used. */
export const TEMP_ID_PREFIX = "temp-";

export function isTempId(id: unknown): boolean {
  return String(id).startsWith(TEMP_ID_PREFIX);
}

export function createTempId(nowMs: number, sequence: number): string {
  return `${TEMP_ID_PREFIX}${nowMs}-${sequence}`;
}

function sameMessage(a: ChatMessage, b: ChatMessage): boolean {
  return (
    a.id === b.id &&
    a.text === b.text &&
    a.time === b.time &&
    a.isOwn === b.isOwn &&
    a.senderId === b.senderId &&
    a.senderName === b.senderName &&
    (a.senderImage ?? null) === (b.senderImage ?? null)
  );
}

export function sameMessageList(a: readonly ChatMessage[] | null, b: readonly ChatMessage[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!sameMessage(a[i], b[i])) return false;
  }
  return true;
}

export function sameMetadata(a: ConversationMetadata | null, b: ConversationMetadata | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.image === b.image &&
    a.fallbackIcon === b.fallbackIcon &&
    a.status === b.status
  );
}

/** Drop repeated ids (keeps the first), so React keys stay unique. */
export function dedupeById<T extends { id: string }>(list: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

/**
 * New server history, or the previous array when nothing changed (so a
 * no-op poll does not re-render the list or move the scroll position).
 */
export function reconcileServerMessages(
  previous: ChatMessage[] | null,
  incoming: readonly ChatMessage[] | null | undefined,
): ChatMessage[] {
  const next = dedupeById(incoming ?? []);
  if (!previous) return next;
  if (sameMessageList(previous, next)) return previous;
  // Something changed (usually a new message at the end): keep the objects of
  // unchanged messages, so their memoised bubbles do not re-render.
  const byId = new Map(previous.map((message) => [String(message.id), message]));
  return next.map((message) => {
    const old = byId.get(String(message.id));
    return old && sameMessage(old, message) ? old : message;
  });
}

/** Remove local sends the server history already contains. Returns the same array when unchanged. */
export function pruneOutbox(outbox: OutboxEntry[], server: readonly ChatMessage[]): OutboxEntry[] {
  if (outbox.length === 0) return outbox;
  const ids = new Set(server.map((message) => String(message.id)));
  const next = outbox.filter((entry) => !entry.serverId || !ids.has(String(entry.serverId)));
  return next.length === outbox.length ? outbox : next;
}

/** Server history followed by our sends that are not in it yet (never duplicated). */
export function buildDisplayMessages(
  server: readonly ChatMessage[],
  outbox: readonly OutboxEntry[],
  ownName: string,
): DisplayMessage[] {
  if (outbox.length === 0) return server as DisplayMessage[];
  const ids = new Set(server.map((message) => String(message.id)));
  const local: DisplayMessage[] = [];
  for (const entry of outbox) {
    const id = entry.serverId ?? entry.tempId;
    if (ids.has(String(id))) continue;
    ids.add(String(id));
    local.push({
      id,
      text: entry.text,
      senderId: "me",
      senderName: ownName,
      time: entry.serverTime ?? entry.time,
      isOwn: true,
      pending: !entry.serverId,
    });
  }
  return local.length ? [...server, ...local] : (server as DisplayMessage[]);
}

/**
 * A poll result may be applied only when no send is in flight and no send
 * started or finished since the poll started. Otherwise it could show our
 * message twice (server copy + temp copy) or drop it (history from before the send).
 */
export function canApplyPollResult(startedEpoch: number, currentEpoch: number, sendsInFlight: number): boolean {
  return sendsInFlight === 0 && startedEpoch === currentEpoch;
}

/**
 * A first-load error that retrying every 4s cannot fix: not a participant
 * (403) or no such conversation (404). Polling stops; the retry button still works.
 */
export function isFatalLoadError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return status === 403 || status === 404;
}

/**
 * True when the newest message is from someone else and was not in the
 * previous history. The first load (previous === null) never counts.
 */
export function hasNewIncomingMessage(previous: readonly ChatMessage[] | null, next: readonly ChatMessage[]): boolean {
  if (!previous) return false;
  const last = next[next.length - 1];
  if (!last || last.isOwn || isTempId(last.id)) return false;
  return !previous.some((message) => String(message.id) === String(last.id));
}

/* ─── Display grouping ──────────────────────────────────────────────────── */

/** Bubbles from the same sender within this gap form one group. */
export const GROUP_GAP_MS = 5 * 60_000;

export type MessageListItem =
  | { kind: "date"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: DisplayMessage;
      /** First bubble of a sender group (others: show the sender name). */
      isFirstInGroup: boolean;
      /** Last bubble of a sender group (show time and, for others, the avatar). */
      isLastInGroup: boolean;
    };

function timeOf(message: ChatMessage): number {
  const ms = new Date(message.time).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function senderKey(message: ChatMessage): string {
  return message.isOwn ? "__me__" : String(message.senderId);
}

/** Insert day separators ("วันนี้", "เมื่อวาน", "2 ต.ค.") and mark sender groups. */
export function buildMessageItems(messages: readonly DisplayMessage[], now: Date = new Date()): MessageListItem[] {
  const items: MessageListItem[] = [];
  let previousDay = "";
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const day = toLocalDateKey(message.time);
    if (day && day !== previousDay) {
      items.push({ kind: "date", key: `date-${day}`, label: formatRelativeDay(message.time, now) });
      previousDay = day;
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const continuesFrom = (a: DisplayMessage | undefined, b: DisplayMessage) =>
      Boolean(
        a &&
          senderKey(a) === senderKey(b) &&
          toLocalDateKey(a.time) === toLocalDateKey(b.time) &&
          Math.abs(timeOf(b) - timeOf(a)) <= GROUP_GAP_MS,
      );
    items.push({
      kind: "message",
      key: String(message.id),
      message,
      isFirstInGroup: !continuesFrom(prev, message),
      isLastInGroup: !next || !continuesFrom(message, next),
    });
  }
  return items;
}
