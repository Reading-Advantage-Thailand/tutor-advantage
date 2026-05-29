import { NextResponse } from "next/server";
import { getActiveTutorSession } from "@/lib/tutor-session";
import { FINANCE_URL } from "@/lib/service-urls";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ payoutLineId: string }> },
) {
  const session = await getActiveTutorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { payoutLineId } = await params;

  try {
    const response = await fetch(
      `${FINANCE_URL}/v1/tutors/earnings/transfers/${encodeURIComponent(payoutLineId)}/sync`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        cache: "no-store",
      },
    );

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to sync transfer status", error);
    return NextResponse.json(
      { error: "Could not sync transfer status" },
      { status: 502 },
    );
  }
}
