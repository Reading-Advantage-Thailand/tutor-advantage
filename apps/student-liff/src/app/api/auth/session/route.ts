import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IDENTITY_URL } from "@/lib/service-urls";

/** Same-origin session probe; it deliberately never returns the JWT. */
export async function GET() {
  const token = (await cookies()).get("student-session")?.value;
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });

  try {
    const response = await fetch(`${IDENTITY_URL}/v1/session`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ authenticated: false }, { status: 401 });

    const data = await response.json() as {
      id?: string;
      name?: string;
      role?: string;
      requiresGuardian?: boolean;
    };
    return NextResponse.json({
      authenticated: true,
      user: {
        userId: data.id,
        displayName: data.name || "",
        role: data.role,
        requiresGuardian: Boolean(data.requiresGuardian),
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 503 });
  }
}
