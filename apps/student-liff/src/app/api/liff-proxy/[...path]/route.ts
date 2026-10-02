import { type NextRequest, NextResponse } from "next/server";

const CDN_BASE = "https://liffsdk.line-scdn.net/xlt";

/**
 * LIFF SDK static extension/i18n files are public and versioned by the SDK, so
 * the browser may reuse them for an hour (repeat cold starts skip this hop).
 * Fallback/error responses are never cached.
 */
const CACHEABLE = { "Cache-Control": "public, max-age=3600" };
const NOT_CACHEABLE = { "Cache-Control": "no-store" };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = `${CDN_BASE}/${path.join("/")}`;
  try {
    const res = await fetch(target, { next: { revalidate: 3600 } });
    const data = await res.json();
    return NextResponse.json(data, { headers: res.ok ? CACHEABLE : NOT_CACHEABLE });
  } catch {
    return NextResponse.json({}, { headers: NOT_CACHEABLE });
  }
}
