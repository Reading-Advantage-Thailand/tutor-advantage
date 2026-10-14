/**
 * Pure helpers for the chat list (/chat).
 * Relative-import-free on purpose (the root vitest config maps "@" to tutor-pwa).
 */

/** A row of GET /chat/conversations. */
export interface Conversation {
  id: string;
  image?: string | null;
  title: string;
  unreadCount: number;
  updatedAt: string;
  lastMessage?: {
    /** The server sends "คุณ" (=== t("chat.you")) for our own last message. */
    sender: string;
    content: string;
  } | null;
  type: "DIRECT" | "GROUP";
}

/** A class of GET /classes, as the chat list uses it. */
export interface EnrolledChatClass {
  id: string;
  name: string;
  tutorName: string;
  tutorUserId: string;
}

/** GET /chat/conversations response. */
export interface ConversationsResponse {
  conversations?: Conversation[] | null;
}

/** Chat-list poll interval (unchanged: 15s while visible). */
export const CHAT_LIST_POLL_MS = 15_000;

/** useCachedResource key of the chat list (also read by the room for its header). */
export function conversationsResourceKey(userId: string): string {
  return `${userId}:chat:conversations`;
}

/**
 * The server marks a room as read when its messages are fetched. Mirror that
 * in the cached list right away, so going back does not show a stale badge.
 * Returns the same object when nothing changes.
 */
export function markConversationRead(
  response: ConversationsResponse | undefined,
  conversationId: string,
): ConversationsResponse | undefined {
  const list = response?.conversations;
  if (!list || !list.some((conversation) => conversation.id === conversationId && conversation.unreadCount > 0)) {
    return response;
  }
  return {
    ...response,
    conversations: list.map((conversation) =>
      conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
    ),
  };
}

export function totalUnread(conversations: readonly Conversation[]): number {
  return conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0);
}

/** Chime only when the unread total grows after we have seen a first total. */
export function shouldPlayUnreadSound(previousTotal: number | undefined, nextTotal: number): boolean {
  return previousTotal !== undefined && nextTotal > previousTotal;
}

/** Case-insensitive title match (same rule as before). */
export function filterConversations(conversations: readonly Conversation[], searchTerm: string): Conversation[] {
  const term = searchTerm.toLowerCase();
  return conversations.filter((conversation) => conversation.title.toLowerCase().includes(term));
}

/** Class name or tutor name match (same rule as before). */
export function filterClasses(classes: readonly EnrolledChatClass[], searchTerm: string): EnrolledChatClass[] {
  const term = searchTerm.toLowerCase();
  return classes.filter(
    (cls) => cls.name.toLowerCase().includes(term) || cls.tutorName.toLowerCase().includes(term),
  );
}

export interface PreviewLabels {
  /** t("chat.you") — compared with lastMessage.sender. Do not reword that key. */
  you: string;
  /** t("chat.youPrefix"), e.g. "คุณ: ". */
  youPrefix: string;
  /** t("chat.noMessages"). */
  noMessages: string;
}

/** "คุณ: ข้อความ" for our own last message, the plain text otherwise, or "ยังไม่มีข้อความ". */
export function getConversationPreview(conversation: Conversation, labels: PreviewLabels): string {
  const last = conversation.lastMessage;
  if (!last) return labels.noMessages;
  return `${last.sender === labels.you ? labels.youPrefix : ""}${last.content}`;
}

/** Key of the row whose /chat/initiate request is running, e.g. "DIRECT-class1". */
export function initiateKey(type: "DIRECT" | "GROUP", classId: string): string {
  return `${type}-${classId}`;
}
