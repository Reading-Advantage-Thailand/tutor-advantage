/** Shapes returned by learning-service `/v1/chat/*` (proxied by `/api/chat/*`). */

export interface ChatConversation {
  id: string;
  /** "DIRECT" | "GROUP" */
  type: string;
  title: string;
  image?: string | null;
  updatedAt: string;
  unreadCount: number;
  lastMessage?: {
    content: string;
    /** Display name of the sender ("คุณ" when it is the tutor). */
    sender?: string | null;
    createdAt?: string | null;
  } | null;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderImage?: string | null;
  /** ISO timestamp */
  time: string;
  isOwn: boolean;
  /** Client-only: optimistic message that the server has not confirmed yet. */
  pending?: boolean;
}

export interface ChatRoomMeta {
  id: string;
  title: string;
  image: string | null;
  fallbackIcon?: string;
  status?: string;
}

export interface ChatRoomData {
  metadata: ChatRoomMeta | null;
  messages: ChatMessage[];
}

export interface ConversationsResponse {
  conversations: ChatConversation[];
}
