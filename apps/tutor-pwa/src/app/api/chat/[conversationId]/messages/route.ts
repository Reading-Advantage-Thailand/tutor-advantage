import { NextResponse } from "next/server";
import { fetchRoom, getTutorToken } from "@/app/dashboard/chat/lib/chat-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/chat/:conversationId/messages: metadata + messages of one room,
 * polled by the open chat room (replaces the old server-action polling).
 * learning-service also marks the room as read for this tutor.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const token = await getTutorToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const result = await fetchRoom(token, conversationId);
  if (!result.ok) {
    const status = result.status === 401 ? 401 : result.status === 403 || result.status === 404 ? 404 : 502;
    return NextResponse.json({ error: "Failed to load messages" }, { status, headers: NO_STORE });
  }
  if (!result.data.metadata) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json(result.data, { headers: NO_STORE });
}
