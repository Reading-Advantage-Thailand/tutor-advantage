"use server";

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
      next: { tags: ['notifications'], revalidate: 60 } // Cache for 60 seconds
    });
    
    if (!res.ok) return { unreadChat: 0, availableAuctions: 0 };
    
    const data = await res.json();
    return data.notifications || { unreadChat: 0, availableAuctions: 0 };
  } catch (error) {
    console.error("Failed to fetch notification summary", error);
    return { unreadChat: 0, availableAuctions: 0 };
  }
}
