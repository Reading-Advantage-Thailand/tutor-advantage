import { NextResponse } from "next/server";

const MANIFEST_URL = "https://liffsdk.line-scdn.net/xlt/manifest.json";

export async function GET() {
  try {
    const res = await fetch(MANIFEST_URL, { next: { revalidate: 3600 } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ createAt: 0, languages: {} });
  }
}
