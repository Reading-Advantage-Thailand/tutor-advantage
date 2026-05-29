import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.error("[CSP-VIOLATION]", JSON.stringify(body));
  } catch {
    console.error("[CSP-VIOLATION] unparseable body");
  }
  return NextResponse.json({ ok: true });
}
