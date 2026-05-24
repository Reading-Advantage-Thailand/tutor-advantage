"use server";

import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { revalidatePath } from "next/cache";

export async function sendMessage(conversationId: string, content: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ content })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to send message");
  }

  revalidatePath("/dashboard/chat");
  revalidatePath(`/dashboard/chat/${conversationId}`);
  return res.json();
}

export async function getConversationMessages(conversationId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/chat/conversations/${conversationId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: 'no-store'
  });
  
  if (!res.ok) {
    return { messages: [] };
  }
  
  return await res.json();
}
