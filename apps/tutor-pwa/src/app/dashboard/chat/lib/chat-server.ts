import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import type { ChatConversation, ChatRoomData } from "./chat-types";
import { isValidConversationId } from "./chat-utils";

/**
 * Server-only helpers for the chat pages and the `/api/chat/*` GET routes.
 * Auth is the same as the chat server actions: forward the httpOnly
 * `tutor_session` cookie as a bearer token; learning-service verifies it and
 * scopes everything to that user. Responses are per-tutor, so they are never
 * cached (`no-store`).
 */

export type ChatFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number };

export async function getTutorToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tutor_session")?.value || null;
}

async function learningGet<T>(path: string, token: string): Promise<ChatFetchResult<T>> {
  try {
    const res = await fetch(`${LEARNING_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch (error) {
    console.error("[chat] learning-service request failed", path, error);
    return { ok: false, status: 502 };
  }
}

export async function fetchConversations(token: string): Promise<ChatFetchResult<ChatConversation[]>> {
  const result = await learningGet<{ conversations?: ChatConversation[] }>("/v1/chat/conversations", token);
  if (!result.ok) return result;
  return { ok: true, data: result.data.conversations ?? [] };
}

/** Messages + metadata. Note: learning-service marks the conversation read for this tutor. */
export async function fetchRoom(token: string, conversationId: string): Promise<ChatFetchResult<ChatRoomData>> {
  if (!isValidConversationId(conversationId)) return { ok: false, status: 404 };
  const result = await learningGet<Partial<ChatRoomData>>(
    `/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    token,
  );
  if (!result.ok) return result;
  return { ok: true, data: { metadata: result.data.metadata ?? null, messages: result.data.messages ?? [] } };
}
