import { NextRequest, NextResponse } from "next/server";

const IDENTITY_URL =
  process.env.IDENTITY_SERVICE_URL || "http://localhost:3001";

// Receives a LINE ID token from the client, exchanges it with identity-service,
// and stores the resulting JWT in a cookie instead of localStorage.
export async function POST(req: NextRequest) {
  const { idToken } = await req.json();

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  const response = await fetch(`${IDENTITY_URL}/v1/auth/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "line", code: idToken }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { message?: string }).message || "Auth failed" },
      { status: response.status }
    );
  }

  const data = await response.json();
  const { sessionToken } = data;

  if (!sessionToken) {
    return NextResponse.json({ error: "No session token returned" }, { status: 500 });
  }

  const res = NextResponse.json({ success: true, user: data.user });

  // Store JWT in a cookie readable by JavaScript (needed for Authorization headers
  // in API calls via Next.js rewrites). Protected by SameSite=Lax.
  res.cookies.set("student-session", sessionToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return res;
}
