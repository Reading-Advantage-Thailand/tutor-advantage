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

  let response: Response;

  try {
    response = await fetch(`${IDENTITY_URL}/v1/auth/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "line", code: idToken }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach identity service";
    console.error("[student-liff] /api/auth/line failed:", message);
    return NextResponse.json(
      {
        error: "Cannot reach identity service",
        details: message,
        identityUrl: IDENTITY_URL,
      },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const errorPayload = err as {
      error?: string | { message?: string; details?: string };
      message?: string;
    };
    const nestedError =
      typeof errorPayload.error === "object" ? errorPayload.error : null;
    const message =
      nestedError?.details ||
      nestedError?.message ||
      (typeof errorPayload.error === "string" ? errorPayload.error : null) ||
      errorPayload.message ||
      "Auth failed";

    return NextResponse.json(
      { error: message },
      { status: response.status },
    );
  }

  const data = await response.json();
  const { sessionToken } = data;

  if (!sessionToken) {
    return NextResponse.json({ error: "No session token returned" }, { status: 500 });
  }

  // Include sessionToken in body so client can set document.cookie manually
  // (needed for LINE WebView / WKWebView which may not apply Set-Cookie from fetch responses)
  const res = NextResponse.json({ success: true, user: data.user, sessionToken });

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
