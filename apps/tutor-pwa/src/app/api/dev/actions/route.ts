import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { FINANCE_URL } from "@/lib/service-urls";

type DevAction =
  | { action: "addVolume"; amountTHB: number }
  | { action: "toggleBadge"; badgeCode: string }
  | { action: "clearVolume" };

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "No session cookie" }, { status: 401 });
  }

  // Decode userId from JWT payload (no verification — dev only)
  let tutorUserId: string | null = null;
  try {
    const b64 = token.split(".")[1];
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
    tutorUserId = payload.userId ?? payload.sub ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!tutorUserId) {
    return NextResponse.json({ error: "No userId in token" }, { status: 401 });
  }

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
