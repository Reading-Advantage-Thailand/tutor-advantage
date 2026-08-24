import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IDENTITY_URL, LEARNING_URL, FINANCE_URL } from "@/lib/service-urls";
import { devRoutesEnabled } from "@/lib/security";

export async function GET() {
  if (!devRoutesEnabled()) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("student-session")?.value;

  if (!token) {
    return NextResponse.json({ error: "No session cookie" }, { status: 401 });
  }

  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

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

  const studentUserId =
    user && typeof user === "object" && "userId" in user
      ? String((user as { userId: string }).userId)
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

  return NextResponse.json({
    user,
    studentUserId,
    dashboard,
    recentPayments,
    notifications,
    tokenExp: null,
    tokenExpiresInSec: null,
    tokenRole: user && typeof user === "object" && "role" in user
      ? String((user as { role: string }).role)
      : null,
    tokenSub: studentUserId,
    lineUserId: null,
  });
}
