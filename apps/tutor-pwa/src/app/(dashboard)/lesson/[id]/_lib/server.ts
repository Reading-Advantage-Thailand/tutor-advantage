import { cache } from "react";
import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { normaliseClassArticles, safeImageUrl, type LessonArticle } from "./articles";

/**
 * Server-only data access for the lesson pre-flow pages. Per-tutor requests
 * are `no-store` and wrapped in React `cache()` so several components of one
 * request share a single call. Never import this from a client component.
 */

async function sessionToken(): Promise<string> {
  const token = (await cookies()).get("tutor_session")?.value;
  if (!token) throw new Error("Unauthorized");
  return token;
}

export interface LessonClassSummary {
  name: string;
  bookTitle: string | null;
}

/** Class name + active book title for the hub header. Null when unavailable. */
export const getLessonClass = cache(async (classId: string): Promise<LessonClassSummary | null> => {
  try {
    const res = await fetch(`${LEARNING_URL}/v1/classes/${encodeURIComponent(classId)}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${await sessionToken()}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { class?: { name?: unknown; book?: unknown } };
    const name = typeof data.class?.name === "string" ? data.class.name.trim() : "";
    if (!name) return null;
    return { name, bookTitle: typeof data.class?.book === "string" && data.class.book ? data.class.book : null };
  } catch {
    return null;
  }
});

/** Articles of the class's active book (same endpoint as `getClassArticles`). Throws on failure. */
export const getLessonArticles = cache(async (classId: string): Promise<LessonArticle[]> => {
  const res = await fetch(`${LEARNING_URL}/v1/classes/${encodeURIComponent(classId)}/articles`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${await sessionToken()}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch class articles (${res.status})`);
  }
  return normaliseClassArticles(await res.json());
});

/* ─── Cover images ────────────────────────────────────────────────────── */

/** Local fallback cover (public/images/lesson-cover.svg). */
export const LESSON_COVER_PLACEHOLDER = "/images/lesson-cover.svg";

const READING_ADVANTAGE_COVER = (articleId: string) =>
  `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${encodeURIComponent(articleId)}.png`;

/**
 * Reachability cache for public cover URLs. Covers are the same for every
 * tutor (public bucket), so a process-wide cache is safe here. Hits are kept
 * for a day, misses for 10 minutes.
 */
const coverCache = new Map<string, { ok: boolean; at: number }>();
const COVER_OK_TTL = 24 * 60 * 60 * 1000;
const COVER_MISS_TTL = 10 * 60 * 1000;

async function isImageReachable(url: string): Promise<boolean> {
  const hit = coverCache.get(url);
  if (hit && Date.now() - hit.at < (hit.ok ? COVER_OK_TTL : COVER_MISS_TTL)) return hit.ok;
  let ok = false;
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(1500) });
    ok = res.ok && (res.headers.get("content-type") ?? "image/").startsWith("image/");
  } catch {
    ok = false;
  }
  if (coverCache.size > 500) coverCache.clear();
  coverCache.set(url, { ok, at: Date.now() });
  return ok;
}

/**
 * Picks the cover the rehearsal stage should show. Articles with their own
 * `image_urls` (Primary content) keep them untouched. Otherwise the stage
 * would fall back to the Reading Advantage bucket image, which is often
 * missing (404) and renders as a broken image with alt text before
 * hydration; so we check it once on the server and return the local
 * placeholder instead when it is not reachable.
 */
export async function resolveArticleCovers(article: { id?: unknown; image_urls?: unknown }): Promise<string[]> {
  const own = Array.isArray(article.image_urls)
    ? article.image_urls.map(safeImageUrl).filter((url): url is string => Boolean(url))
    : [];
  if (own.length > 0) return own;
  const id = typeof article.id === "string" || typeof article.id === "number" ? String(article.id) : "";
  if (!id || id.startsWith("workbook:")) return [LESSON_COVER_PLACEHOLDER];
  const remote = READING_ADVANTAGE_COVER(id);
  return [(await isImageReachable(remote)) ? remote : LESSON_COVER_PLACEHOLDER];
}
