import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IDENTITY_URL, LEARNING_URL, FINANCE_URL } from "@/lib/service-urls";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("student-session")?.value;

  if (!token) {
    return NextResponse.json({ error: "No session cookie" }, { status: 401 });
  }

  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

  // Decode JWT payload (no verification — dev only)
  let tokenInfo: {
    userId?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    role?: string;
    lineUserId?: string;
  } = {};
  try {
    const b64 = token.split(".")[1];
    tokenInfo = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch {
    // ignore malformed token
  }

  const studentUserId = tokenInfo.userId ?? tokenInfo.sub ?? null;

  const [userRes, dashboardRes, paymentsRes, notifRes] = await Promise.allSettled([
    fetch(`${IDENTITY_URL}/v1/users/me`, { headers, cache: "no-store" }),
    fetch(`${LEARNING_URL}/v1/dashboard/summary`, { headers, cache: "no-store" }),
    fetch(`${FINANCE_URL}/v1/payments/history`, { headers, cache: "no-store" }),
    fetch(`${LEARNING_URL}/v1/notifications/summary`, { headers, cache: "no-store" }),
  ]);

  const user =
    userRes.status === "fulfilled" && userRes.value.ok
      ? await userRes.value.json().then((d: { user?: unknown }) => d.user ?? d)
      : null;

  const dashboard =
    dashboardRes.status === "fulfilled" && dashboardRes.value.ok
      ? await dashboardRes.value.json()
      : null;

  // Extract recent payments (last 3)
  const paymentsRaw =
    paymentsRes.status === "fulfilled" && paymentsRes.value.ok
      ? await paymentsRes.value.json()
      : null;
  const recentPayments = (
    (paymentsRaw?.payments ?? paymentsRaw?.history ?? []) as Array<{
      paymentIntentId?: string;
      id?: string;
      amountSatang?: number;
      amount?: number;
      status?: string;
      createdAt?: string;
      className?: string;
    }>
  ).slice(0, 3);

  const notifications =
    notifRes.status === "fulfilled" && notifRes.value.ok
      ? await notifRes.value
          .json()
          .then((d: { notifications?: unknown }) => d.notifications ?? d)
      : null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = tokenInfo.exp ? tokenInfo.exp - nowSec : null;

  return NextResponse.json({
    user,
    studentUserId,
    dashboard,
    recentPayments,
    notifications,
    tokenMasked: `${token.slice(0, 10)}…${token.slice(-8)}`,
    tokenRaw: token,
    tokenExp: tokenInfo.exp ?? null,
    tokenExpiresInSec: expiresIn,
    tokenRole: tokenInfo.role ?? null,
    tokenSub: studentUserId,
    lineUserId: tokenInfo.lineUserId ?? null,
  });
}
