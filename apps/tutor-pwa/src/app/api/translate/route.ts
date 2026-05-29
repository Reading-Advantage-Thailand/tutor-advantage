import { NextRequest, NextResponse } from "next/server";
import { getActiveTutorSession } from "@/lib/tutor-session";

export async function POST(req: NextRequest) {
  // Require an active session to prevent API key abuse
  const session = await getActiveTutorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { texts } = await req.json();

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: "texts must be a non-empty array" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      console.error("[translate] GOOGLE_TRANSLATE_API_KEY is not set");
      return NextResponse.json(
        { error: "Translation service not configured" },
        { status: 500 }
      );
    }

    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: texts, source: "en", target: "th", format: "text" }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[translate] Google API error:", res.status, err);
      return NextResponse.json({ error: "Translation failed" }, { status: res.status });
    }

    const data = await res.json();
    const translations: string[] = data.data.translations.map(
      (t: { translatedText: string }) => t.translatedText
    );

    return NextResponse.json({ translations });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[translate] Exception:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
