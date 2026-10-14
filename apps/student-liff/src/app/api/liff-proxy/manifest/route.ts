import { NextResponse } from "next/server";

const MANIFEST_URL = "https://liffsdk.line-scdn.net/xlt/manifest.json";

/** Public LIFF SDK manifest: cacheable for an hour; the fallback is never cached. */
const CACHEABLE = { "Cache-Control": "public, max-age=3600" };
const NOT_CACHEABLE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const res = await fetch(MANIFEST_URL, { next: { revalidate: 3600 } });
    const data = await res.json();
    return NextResponse.json(data, { headers: res.ok ? CACHEABLE : NOT_CACHEABLE });
  } catch {
    return NextResponse.json({ createAt: 0, languages: {} }, { headers: NOT_CACHEABLE });
  }
}
