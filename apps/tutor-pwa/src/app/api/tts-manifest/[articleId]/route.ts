import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ articleId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { articleId } = await context.params;
  if (!articleId || !/^[A-Za-z0-9_-]+$/.test(articleId)) {
    return NextResponse.json({ error: "Invalid article ID" }, { status: 400 });
  }

  const bucket = process.env.GCS_BUCKET_NAME || "tutor_advantage_bucket";
  const manifestUrl = `https://storage.googleapis.com/${bucket}/articles/${articleId}/manifest.json`;

  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ error: "TTS manifest not found" }, { status: response.status });
    }

    const manifest = await response.json();
    if (manifest?.version !== 1 || manifest?.articleId !== articleId) {
      return NextResponse.json({ error: "Invalid TTS manifest" }, { status: 502 });
    }

    return NextResponse.json(manifest, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json({ error: "Could not load TTS manifest" }, { status: 502 });
  }
}
