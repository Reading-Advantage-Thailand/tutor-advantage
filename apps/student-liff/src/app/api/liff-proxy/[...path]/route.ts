import { type NextRequest, NextResponse } from "next/server";

const CDN_BASE = "https://liffsdk.line-scdn.net/xlt";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = `${CDN_BASE}/${path.join("/")}`;
  try {
    const res = await fetch(target, { next: { revalidate: 3600 } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({});
  }
}
