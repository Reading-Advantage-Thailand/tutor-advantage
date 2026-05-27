import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { FINANCE_URL, LEARNING_URL } from "@/lib/service-urls";

type DevAction =
  | { action: "confirmPayment"; paymentIntentId: string }
  | { action: "confirmAllPending" }
  | { action: "seedLessonHistory" }
  | { action: "purgeLessonHistory" }
  | { action: "activateEnrollments" }
  | { action: "clearSession" };

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("student-session")?.value;
  if (!token) {
    return NextResponse.json({ error: "No session cookie" }, { status: 401 });
  }

  const authHeaders: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  let body: DevAction;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Confirm a specific payment (mock) ──────────────────────────────────────
  if (body.action === "confirmPayment") {
    const res = await fetch(`${FINANCE_URL}/v1/payments/confirm-mock`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ paymentIntentId: body.paymentIntentId }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  // ── Confirm ALL pending payments ───────────────────────────────────────────
  if (body.action === "confirmAllPending") {
    const histRes = await fetch(`${FINANCE_URL}/v1/payments/history`, { headers: authHeaders });
    if (!histRes.ok) {
      return NextResponse.json({ error: "Failed to fetch payment history" }, { status: 502 });
    }
    const histData = await histRes.json();
    const payments: Array<{ paymentIntentId?: string; id?: string; status?: string }> =
      histData.payments ?? histData.history ?? [];
    const pending = payments.filter(
      (p) => p.status?.toLowerCase().includes("pending") || p.status === "AWAITING_PAYMENT",
    );

    const results = await Promise.allSettled(
      pending.map((p) => {
        const id = p.paymentIntentId ?? p.id;
        return fetch(`${FINANCE_URL}/v1/payments/confirm-mock`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ paymentIntentId: id }),
        });
      }),
    );

    const confirmed = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ confirmed, total: pending.length });
  }

  // ── Seed lesson history ────────────────────────────────────────────────────
  // Creates FINISHED sessions + participation records from the student's enrolled class articles
  if (body.action === "seedLessonHistory") {
    const res = await fetch(`${LEARNING_URL}/v1/dev/seed/lesson-history`, {
      method: "POST",
      headers: authHeaders,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  }

  // ── Purge lesson history ───────────────────────────────────────────────────
  // Deletes all FINISHED sessions the student participated in
  if (body.action === "purgeLessonHistory") {
    const res = await fetch(`${LEARNING_URL}/v1/dev/seed/lesson-history`, {
      method: "DELETE",
      headers: authHeaders,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  }

  // ── Activate pending enrollments ───────────────────────────────────────────
  // Marks PENDING_PAYMENT enrollments as ACTIVE (simulates payment without going through Omise)
  if (body.action === "activateEnrollments") {
    const res = await fetch(`${LEARNING_URL}/v1/dev/seed/enrollments/activate`, {
      method: "POST",
      headers: authHeaders,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  }

  // ── Clear session ──────────────────────────────────────────────────────────
  if (body.action === "clearSession") {
    const response = NextResponse.json({ ok: true, message: "Session cleared" });
    response.cookies.delete("student-session");
    return response;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
