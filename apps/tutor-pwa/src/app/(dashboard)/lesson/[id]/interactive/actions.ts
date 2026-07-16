"use server";

import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";

export async function sendLobbyNotifications(classId: string, articleTitle: string) {
  const token = (await cookies()).get("tutor_session")?.value;
  if (!token) throw new Error("Unauthorized");

  const response = await fetch(`${LEARNING_URL}/v1/classes/${classId}/lobby-notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ articleTitle }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Could not send LINE notifications");
  }
  return data as { eligible: number; sent: number; failures?: Record<string, number> };
}
