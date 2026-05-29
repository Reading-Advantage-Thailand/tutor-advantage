import { NextResponse } from "next/server";
import { IDENTITY_URL, FINANCE_URL, LEARNING_URL } from "@/lib/service-urls";
import { getActiveTutorSession } from "@/lib/tutor-session";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const session = await getActiveTutorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, user: activeUser } = session;
  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

  // Decode display-only token metadata for the dev toolbar.
  let tokenInfo: { exp?: number; iat?: number; role?: string } = {};
  try {
    const b64 = token.split(".")[1];
    tokenInfo = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch {
    // ignore malformed token
  }

  const [userRes, earningsRes, notifRes, badgesRes] = await Promise.allSettled([
    fetch(`${IDENTITY_URL}/v1/users/me`, { headers, cache: "no-store" }),
    fetch(`${FINANCE_URL}/v1/tutors/earnings/history`, { headers, cache: "no-store" }),
    fetch(`${LEARNING_URL}/v1/notifications/summary`, { headers, cache: "no-store" }),
    fetch(`${FINANCE_URL}/v1/dev/tutor-badges/${activeUser.userId}`, { cache: "no-store" }),
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

  const badges: string[] =
    badgesRes.status === "fulfilled" &&
    badgesRes.value !== null &&
    badgesRes.value.ok
      ? await badgesRes.value
          .json()
          .then((d: { badges?: string[] }) => d.badges ?? [])
      : [];

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = tokenInfo.exp ? tokenInfo.exp - nowSec : null;

  return NextResponse.json({
    user,
    earnings,
    notifications,
    badges,
    tokenMasked: `${token.slice(0, 10)}…${token.slice(-8)}`,
    tokenExp: tokenInfo.exp ?? null,
    tokenExpiresInSec: expiresIn,
    tokenRole: tokenInfo.role ?? null,
    tokenSub: activeUser.userId,
  });
}
