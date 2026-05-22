import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { texts } = await req.json();

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: "texts must be a non-empty array" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      console.error("[translate] GOOGLE_TRANSLATE_API_KEY is not set");
      return NextResponse.json({ error: "GOOGLE_TRANSLATE_API_KEY not configured" }, { status: 500 });
    }

    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: texts,
          source: "en",
          target: "th",
          format: "text",
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[translate] Google API error:", res.status, err);
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const translations: string[] = data.data.translations.map(
      (t: { translatedText: string }) => t.translatedText
    );

    return NextResponse.json({ translations });
  } catch (e: any) {
    console.error("[translate] Exception:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
