// Pure view-model helpers for the lesson history list.
// Relative imports only: vitest maps "@" to another app.
import { toLocalDateKey } from "../../../../lib/format";

export interface HistoryItem {
  sessionId: string;
  date: string;
  rank: number;
  totalParticipants: number;
  articleTitle: string;
  tutorName: string;
  score: number;
}

export interface HistoryDayGroup {
  /** Local calendar day, "2026-10-02" (for keys only). */
  dayKey: string;
  /** Any timestamp of that day, for the header label. */
  date: string;
  items: HistoryItem[];
}

/**
 * Groups sessions by local calendar day, keeping the server order (newest
 * first) for both the groups and the rows inside each group.
 */
export function groupHistoryByDay(items: HistoryItem[]): HistoryDayGroup[] {
  const groups: HistoryDayGroup[] = [];
  const byKey = new Map<string, HistoryDayGroup>();
  for (const item of items) {
    const dayKey = toLocalDateKey(item.date) || "unknown";
    let group = byKey.get(dayKey);
    if (!group) {
      group = { dayKey, date: item.date, items: [] };
      byKey.set(dayKey, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export interface HistorySummary {
  lessons: number;
  totalScore: number;
  /** Best (lowest) valid rank, or null when no session has a rank. */
  bestRank: number | null;
}

export function summarizeHistory(items: HistoryItem[]): HistorySummary {
  let totalScore = 0;
  let bestRank: number | null = null;
  for (const item of items) {
    if (Number.isFinite(item.score)) totalScore += item.score;
    if (Number.isFinite(item.rank) && item.rank > 0 && (bestRank === null || item.rank < bestRank)) {
      bestRank = item.rank;
    }
  }
  return { lessons: items.length, totalScore, bestRank };
}
