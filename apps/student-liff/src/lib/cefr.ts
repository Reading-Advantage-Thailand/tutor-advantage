/**
 * CEFR level helpers for class cards, filters and lesson rows. Pure (no React,
 * no i18n) so tests can load it directly.
 */

/** Levels offered as filter chips on the class catalog (sent as `cefr=`). */
export const CEFR_FILTER_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;
export type CefrFilterLevel = (typeof CEFR_FILTER_LEVELS)[number];

/** Colour family for a level; maps onto the IconTile/tile tokens (light + dark aware). */
export type CefrTone = "brand" | "blue" | "purple" | "neutral";

/** Trimmed upper-case level, or null for empty / non-string values (Primary books send null). */
export function normalizeCefr(level: unknown): string | null {
  if (typeof level !== "string") return null;
  const trimmed = level.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

/** A* → brand green, B* → blue, C* → purple, unknown → neutral. Null-safe. */
export function cefrTone(level: unknown): CefrTone {
  const normalized = normalizeCefr(level);
  if (!normalized) return "neutral";
  if (normalized.startsWith("C")) return "purple";
  if (normalized.startsWith("B")) return "blue";
  if (normalized.startsWith("A")) return "brand";
  return "neutral";
}

/**
 * "A1 · Lv.3" label for a class. Missing values fall back to "A1" and 1, as
 * the catalog always did.
 */
export function formatLevelLabel(cefr: unknown, level: unknown, levelPrefix = "Lv."): string {
  const safeCefr = normalizeCefr(cefr) ?? "A1";
  const safeLevel = typeof level === "number" && level > 0 ? level : 1;
  return `${safeCefr} · ${levelPrefix}${safeLevel}`;
}

/**
 * Legacy element id for a filter chip (kept for external QA scripts):
 * the old labels were "ทั้งหมด" and "Reading A1"…
 */
export function cefrFilterChipId(level: string | null, allLabel: string): string {
  const label = level ? `Reading ${level}` : allLabel;
  return `chip-filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
}
