import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IDENTITY_URL } from "@/lib/service-urls";

/**
 * The long-lived session remains HttpOnly.  The browser receives only this
 * short-lived, audience-bound token needed to establish a lesson socket.
 */
export async function GET() {
  const token = (await cookies()).get("student-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const response = await fetch(`${IDENTITY_URL}/v1/auth/socket-token`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.socketToken !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: response.ok ? 502 : 401 });
    }
    return NextResponse.json(
      { socketToken: data.socketToken, expiresIn: data.expiresIn },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Identity service unavailable" }, { status: 503 });
  }
}
