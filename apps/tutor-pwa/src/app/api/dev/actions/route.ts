import { NextResponse, NextRequest } from "next/server";
import { FINANCE_URL } from "@/lib/service-urls";
import { getActiveTutorSession } from "@/lib/tutor-session";
import { devRoutesEnabled } from "@/lib/security";

type DevAction =
  | { action: "addVolume"; amountTHB: number }
  | { action: "toggleBadge"; badgeCode: string }
  | { action: "clearVolume" };

export async function POST(req: NextRequest) {
  if (!devRoutesEnabled()) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const session = await getActiveTutorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tutorUserId = session.user.userId;

  let body: DevAction;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "addVolume") {
    const res = await fetch(`${FINANCE_URL}/v1/dev/actions/add-volume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tutorUserId, amountTHB: body.amountTHB }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (body.action === "toggleBadge") {
    const res = await fetch(`${FINANCE_URL}/v1/dev/actions/toggle-badge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tutorUserId, badgeCode: body.badgeCode }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (body.action === "clearVolume") {
    const res = await fetch(`${FINANCE_URL}/v1/dev/actions/purge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: "volume" }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
