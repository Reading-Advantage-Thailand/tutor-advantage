"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { cookies } from "next/headers";

export async function getNotificationsSummary() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) return { unreadChat: 0, availableAuctions: 0 };

  try {
    const res = await fetch("http://localhost:3002/v1/notifications/summary", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      next: { revalidate: 0 } // Do not cache summary endpoint heavily
    });
    
    if (!res.ok) return { unreadChat: 0, availableAuctions: 0 };
    
    const data = await res.json();
    return data.notifications || { unreadChat: 0, availableAuctions: 0 };
  } catch (error) {
    console.error("Failed to fetch notification summary", error);
    return { unreadChat: 0, availableAuctions: 0 };
  }
}

export async function updateSettingsAction(settings: any) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) throw new Error("Unauthorized");

  const res = await fetch("http://localhost:3001/v1/users/me/settings", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(settings),
  });

  if (!res.ok) throw new Error("Failed to update settings");
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/dashboard", "layout");
  
  const data = await res.json();
  return data.settings;
}
