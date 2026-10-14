import { NextResponse } from "next/server";
import { fetchConversations, getTutorToken } from "@/app/dashboard/chat/lib/chat-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** GET /api/chat/conversations: the signed-in tutor's conversation list (polled by the chat list). */
export async function GET() {
  const token = await getTutorToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const result = await fetchConversations(token);
  if (!result.ok) {
    const status = result.status === 401 ? 401 : 502;
    return NextResponse.json({ error: "Failed to load conversations" }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ conversations: result.data }, { headers: NO_STORE });
}
