const BASE_SECONDS_PER_ARTICLE = 300;
const BOOK_GRACE_SECONDS = 1_200;

export function calculateUnlockedSeconds(completedArticles: number, totalArticles: number) {
  if (totalArticles <= 0) return 0;
  const completed = Math.max(0, Math.min(totalArticles, completedArticles));
  return completed * BASE_SECONDS_PER_ARTICLE + Math.floor((completed * BOOK_GRACE_SECONDS) / totalArticles);
}

export function calculateTotalSeconds(totalArticles: number) {
  return totalArticles > 0 ? totalArticles * BASE_SECONDS_PER_ARTICLE + BOOK_GRACE_SECONDS : 0;
}
