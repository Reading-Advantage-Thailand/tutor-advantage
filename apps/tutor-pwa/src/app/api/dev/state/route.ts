import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IDENTITY_URL, FINANCE_URL, LEARNING_URL } from "@/lib/service-urls";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) {
    return NextResponse.json({ error: "No session cookie" }, { status: 401 });
  }

  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

  const [userRes, earningsRes, notifRes] = await Promise.allSettled([
    fetch(`${IDENTITY_URL}/v1/users/me`, { headers, cache: "no-store" }),
    fetch(`${FINANCE_URL}/v1/tutors/earnings/history`, { headers, cache: "no-store" }),
    fetch(`${LEARNING_URL}/v1/notifications/summary`, { headers, cache: "no-store" }),
  ]);

  const user =
    userRes.status === "fulfilled" && userRes.value.ok
      ? await userRes.value.json().then((d: { user?: unknown }) => d.user)
      : null;

  const earnings =
    earningsRes.status === "fulfilled" && earningsRes.value.ok
      ? await earningsRes.value.json()
      : null;

  const notifications =
    notifRes.status === "fulfilled" && notifRes.value.ok
      ? await notifRes.value
          .json()
          .then((d: { notifications?: unknown }) => d.notifications)
      : null;

  // Decode JWT payload (no verification — dev only)
  let tokenInfo: { sub?: string; exp?: number; iat?: number; role?: string } = {};
  try {
    const b64 = token.split(".")[1];
    tokenInfo = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch {
    // ignore malformed token
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = tokenInfo.exp ? tokenInfo.exp - nowSec : null;

  return NextResponse.json({
    user,
    earnings,
    notifications,
    tokenMasked: `${token.slice(0, 10)}…${token.slice(-8)}`,
    tokenExp: tokenInfo.exp ?? null,
    tokenExpiresInSec: expiresIn,
    tokenRole: tokenInfo.role ?? null,
    tokenSub: tokenInfo.sub ?? null,
  });
}
