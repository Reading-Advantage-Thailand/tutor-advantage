import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.error("[CLIENT-ERROR]", JSON.stringify(body));
  } catch {
    console.error("[CLIENT-ERROR] unparseable body");
  }
  return NextResponse.json({ ok: true });
}
