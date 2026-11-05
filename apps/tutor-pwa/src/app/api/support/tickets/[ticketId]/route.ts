import { NextResponse } from "next/server";
import { fetchTicket, getTutorToken } from "@/app/dashboard/support/lib/support-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/support/tickets/:ticketId: one ticket with its thread, polled by
 * the open ticket page. learning-service also marks it read for this tutor.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const token = await getTutorToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const result = await fetchTicket(token, ticketId);
  if (!result.ok) {
    const status = result.status === 401 ? 401 : result.status === 403 || result.status === 404 ? 404 : 502;
    return NextResponse.json({ error: "Failed to load ticket" }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ticket: result.data }, { headers: NO_STORE });
}
