import { NextResponse } from "next/server";
import { getActiveTutorSession } from "@/lib/tutor-session";
import { LEARNING_URL } from "@/lib/service-urls";

const EMPTY_SUMMARY = { unreadChat: 0, availableAuctions: 0, supportUpdates: 0 };

export async function GET() {
  const session = await getActiveTutorSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${LEARNING_URL}/v1/notifications/summary`, {
      headers: { Authorization: `Bearer ${session.token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(EMPTY_SUMMARY);
    }

    const data = await response.json();
    return NextResponse.json({ ...EMPTY_SUMMARY, ...(data.notifications || {}) });
  } catch (error) {
    console.error("Failed to fetch notification summary", error);
    return NextResponse.json(EMPTY_SUMMARY);
  }
}
