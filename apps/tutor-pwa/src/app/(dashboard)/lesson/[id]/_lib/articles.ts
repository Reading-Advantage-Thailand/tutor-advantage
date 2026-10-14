/**
 * Pure helpers for the lesson pre-flow (hub · select · prepare). No React,
 * no fetch: everything here is unit-tested in articles.test.ts.
 */

/** One article of the class's active book, as the select/hub pages use it. */
export interface LessonArticle {
  id: string;
  articleNumber: number;
  title: string;
  /** Thai summary (may be empty). */
  summary: string;
  /** English passage snippet (may be empty). */
  passage: string;
  /** CEFR level to display, or null when hidden (Primary books) / unknown. */
  cefrLevel: string | null;
  /** Cover image URL, or null when the article has none. */
  imageUrl: string | null;
  isCompleted: boolean;
}

export type LessonStatusFilter = "all" | "todo" | "done";

export interface LessonProgress {
  done: number;
  total: number;
  /** 0–100, rounded. */
  percent: number;
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** Accepts only absolute http(s) URLs or root-relative paths; anything else is dropped. */
export function safeImageUrl(value: unknown): string | null {
  const url = str(value).trim();
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Normalises the `/v1/classes/:id/articles` payload. Tolerates missing fields
 * and keeps the server's order; `articleNumber` falls back to the position.
 */
export function normaliseClassArticles(payload: unknown): LessonArticle[] {
  const raw = (payload as { articles?: unknown } | null)?.articles;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && item.id != null)
    .map((item, index) => {
      const number = Number(item.articleNumber);
      const imageUrls = Array.isArray(item.imageUrls) ? item.imageUrls : [];
      const cefr = str(item.cefrLevel).replace(/^CEFR\s*/i, "").trim();
      return {
        id: String(item.id),
        articleNumber: Number.isFinite(number) && number > 0 ? number : index + 1,
        title: str(item.title).trim() || "—",
        summary: str(item.summary).trim(),
        passage: str(item.passage).trim(),
        cefrLevel: item.showCefr === false || !cefr ? null : cefr,
        imageUrl: safeImageUrl(imageUrls[0]) ?? safeImageUrl(item.imageUrl),
        isCompleted: item.isCompleted === true,
      };
    });
}

export function getLessonProgress(articles: readonly LessonArticle[]): LessonProgress {
  const total = articles.length;
  const done = articles.filter((article) => article.isCompleted).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * The article to teach next: the first one not yet completed (in book order).
 * Null when every article is done or the list is empty.
 */
export function getNextArticle(articles: readonly LessonArticle[]): LessonArticle | null {
  return articles.find((article) => !article.isCompleted) ?? null;
}

/** Lower-cases and strips spacing/diacritic-insensitive noise for matching. */
function normaliseQuery(value: string): string {
  return value.toLocaleLowerCase("th").normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Filters by status and a free-text query. The query matches the title,
 * Thai summary, English snippet or chapter number ("5", "บท 5", "บทที่ 5", "#5").
 */
export function filterArticles(
  articles: readonly LessonArticle[],
  query: string,
  status: LessonStatusFilter = "all",
): LessonArticle[] {
  const q = normaliseQuery(query);
  const numberMatch = q.match(/^(?:บทที่|บท|#|no\.?|chapter)?\s*(\d+)$/);
  const wantedNumber = numberMatch ? Number(numberMatch[1]) : null;
  return articles.filter((article) => {
    if (status === "todo" && article.isCompleted) return false;
    if (status === "done" && !article.isCompleted) return false;
    if (!q) return true;
    if (wantedNumber !== null && article.articleNumber === wantedNumber) return true;
    const haystack = normaliseQuery(`${article.title} ${article.summary} ${article.passage}`);
    return haystack.includes(q);
  });
}

export type PreparationMode = "explore" | "guided";

export function parsePreparationMode(value: unknown): PreparationMode {
  return value === "guided" ? "guided" : "explore";
}

/** Where "start" goes from the select page: live lobby, or the private rehearsal. */
export function lessonStartHref(classId: string, articleId: string, preparationMode: PreparationMode | null): string {
  const id = encodeURIComponent(classId);
  const article = encodeURIComponent(articleId);
  return preparationMode
    ? `/lesson/${id}/prepare/lesson?articleId=${article}&mode=${preparationMode}`
    : `/lesson/${id}/interactive?articleId=${article}`;
}

/** Fills `{name}` placeholders in a locale string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
