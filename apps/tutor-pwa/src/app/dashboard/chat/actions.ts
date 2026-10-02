"use server";

import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import type { ChatMessage } from "./lib/chat-types";
import { isValidConversationId } from "./lib/chat-utils";

/**
 * Send a chat message (mutation; reads/polling go through the GET route
 * `/api/chat/:id/messages`). The client refreshes its cached room and list
 * afterwards, so no `revalidatePath` (it would re-render the whole route).
 */
export async function sendMessage(conversationId: string, content: string): Promise<ChatMessage> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) {
    throw new Error("Unauthorized");
  }
  if (!isValidConversationId(conversationId)) {
    throw new Error("Conversation not found");
  }

  const res = await fetch(`${LEARNING_URL}/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to send message");
  }

  return res.json();
}
