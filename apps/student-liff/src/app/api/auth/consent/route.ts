import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IDENTITY_URL } from "@/lib/service-urls";

export async function POST(req: NextRequest) {
  try {
    const { consentType } = await req.json();
    const cookieStore = await cookies();
    const token = cookieStore.get("student-session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await fetch(`${IDENTITY_URL}/v1/users/me/consents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ consentType }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData?.error?.message || "Failed to record consent" },
        { status: res.status }
      );
    }

    return NextResponse.json({ message: "Success" });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
