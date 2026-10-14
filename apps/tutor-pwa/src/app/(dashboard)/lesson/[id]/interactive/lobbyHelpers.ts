/** Pure helpers for the live lobby (tested in lobbyHelpers.test.ts). */

const ARTICLE_IMAGE_BASE = "https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images";

/** First usable article image, else the conventional GCS cover for the article id. */
export function getArticleCoverUrl(articleData: unknown): string | null {
  const article = (articleData ?? {}) as { image_urls?: unknown; id?: unknown };
  const primary = Array.isArray(article.image_urls)
    ? article.image_urls.find((url: unknown): url is string => typeof url === "string" && url.length > 0)
    : undefined;
  if (primary) return primary;
  return typeof article.id === "string" && article.id ? `${ARTICLE_IMAGE_BASE}/${article.id}.png` : null;
}

/** Thai summary first (translated → summary.th), then plain summary / description. */
export function getArticleSummary(articleData: unknown): string {
  const article = (articleData ?? {}) as {
    translated_summary?: { th?: unknown };
    summary?: unknown;
    description?: unknown;
  };
  const firstThai = (value: unknown) => (Array.isArray(value) && typeof value[0] === "string" ? value[0] : "");
  return (
    firstThai(article.translated_summary?.th) ||
    firstThai((article.summary as { th?: unknown } | undefined)?.th) ||
    (typeof article.summary === "string" ? article.summary : "") ||
    (typeof article.description === "string" ? article.description : "")
  );
}

/** "A2" from "CEFR A2"; "Elementary" for Primary Advantage books; null when unknown. */
export function getCefrLabel(articleData: unknown): string | null {
  const article = (articleData ?? {}) as { cefr_level?: unknown; content_provider?: unknown };
  if (article.cefr_level) return String(article.cefr_level).replace(/^CEFR\s*/i, "");
  return article.content_provider === "PRIMARY_ADVANTAGE" ? "Elementary" : null;
}

/** Thai explanation for the first LINE delivery failure reason. */
export function formatLobbyNotificationFailure(failures?: Record<string, number>) {
  const [reason, count = 0] = Object.entries(failures || {})[0] || [];
  if (reason === "PREFERENCE_DISABLED") return `นักเรียนปิดการแจ้งเตือน ${count} คน`;
  if (reason === "LINE_NOT_LINKED") return `นักเรียนยังไม่ได้เชื่อม LINE ${count} คน`;
  if (reason === "LINE_API_400")
    return "LINE ไม่พบผู้รับใน OA นี้ — ให้ตรวจว่า LINE Login และ Messaging API อยู่ใน Provider เดียวกัน และนักเรียน add friend OA แล้ว";
  if (reason?.startsWith("LINE_API_")) return `LINE ปฏิเสธการส่ง (${reason.replace("LINE_API_", "HTTP ")})`;
  if (reason === "LINE_NOT_CONFIGURED") return "ยังไม่ได้ตั้งค่า LINE Messaging API ใน backend";
  return "ยังส่ง LINE ไม่ได้ — ไม่พบผู้รับที่ส่งได้";
}
