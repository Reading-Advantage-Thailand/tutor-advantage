import { NextRequest, NextResponse } from "next/server";

/** Keep one bad client from flooding the logs. */
const MAX_LOG_CHARS = 8_000;

/** Happy-path breadcrumbs from LiffProvider (sent only while LIFF debugging is on). */
const BREADCRUMB_STAGE = /(^|_)(start|success|ok)$/;

function isFailure(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return true;
  const { level, stage } = body as { level?: unknown; stage?: unknown };
  if (level === "info") return false;
  if (level === "error") return true;
  return !(typeof stage === "string" && BREADCRUMB_STAGE.test(stage));
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const serialized = JSON.stringify(body).slice(0, MAX_LOG_CHARS);
    if (isFailure(body)) {
      console.error("[CLIENT-ERROR]", serialized);
    } else {
      console.info("[CLIENT-BREADCRUMB]", serialized);
    }
  } catch {
    console.error("[CLIENT-ERROR] unparseable body");
  }
  return NextResponse.json({ ok: true });
}
