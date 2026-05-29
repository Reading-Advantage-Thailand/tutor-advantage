import { NextResponse } from "next/server";
import { getActiveTutorSession } from "@/lib/tutor-session";

export async function GET() {
  const session = await getActiveTutorSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl =
      process.env.LEARNING_API_BASE_URL || "http://localhost:3002";
    const response = await fetch(`${baseUrl}/v1/notifications/summary`, {
      headers: { Authorization: `Bearer ${session.token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ unreadChat: 0, availableAuctions: 0 });
    }

    const data = await response.json();
    return NextResponse.json(
      data.notifications || { unreadChat: 0, availableAuctions: 0 },
    );
  } catch (error) {
    console.error("Failed to fetch notification summary", error);
    return NextResponse.json({ unreadChat: 0, availableAuctions: 0 });
  }
}
