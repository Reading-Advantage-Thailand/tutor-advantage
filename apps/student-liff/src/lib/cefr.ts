/**
 * CEFR level helpers for class cards, filters and lesson rows. Pure (no React,
 * no i18n) so tests can load it directly.
 */

/** Levels offered as filter chips on the class catalog (sent as `cefr=`). */
export const CEFR_FILTER_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;
export type CefrFilterLevel = (typeof CEFR_FILTER_LEVELS)[number];

/**
 * Colour for a level; each name maps onto the IconTile/tile tokens
 * (`bg-tile-*`, `text-icon-*`, light + dark aware).
 */
export type CefrTone = "teal" | "brand" | "orange" | "blue" | "purple" | "pink" | "neutral";

/** One distinct, kid-friendly colour per CEFR level (beginner → advanced). */
export const CEFR_LEVEL_TONES: Readonly<Record<CefrFilterLevel, CefrTone>> = {
  A0: "teal",
  A1: "brand",
  A2: "orange",
  B1: "blue",
  B2: "purple",
  C1: "pink",
};

/** Trimmed upper-case level, or null for empty / non-string values (Primary books send null). */
export function normalizeCefr(level: unknown): string | null {
  if (typeof level !== "string") return null;
  const trimmed = level.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

/**
 * Level → colour (A0 teal, A1 green, A2 orange, B1 blue, B2 purple, C1 pink).
 * Unlisted levels fall back by family (C2 → pink, other A → green, B → blue);
 * null / unknown → neutral. Never throws.
 */
export function getLevelTone(level: unknown): CefrTone {
  const normalized = normalizeCefr(level);
  if (!normalized) return "neutral";
  if (Object.hasOwn(CEFR_LEVEL_TONES, normalized)) return CEFR_LEVEL_TONES[normalized as CefrFilterLevel];
  if (/^C\d/.test(normalized)) return "pink";
  if (/^B\d/.test(normalized)) return "blue";
  if (/^A\d/.test(normalized)) return "brand";
  return "neutral";
}

/** @deprecated alias of {@link getLevelTone}. */
export const cefrTone = getLevelTone;

/**
 * Tailwind classes for a level colour: `soft` tinted background, `solid`
 * accent strip / dot, `text` coloured text (≥3:1 — use for large/bold text or
 * icons; put small labels in text-fg on the `soft` background).
 */
export const levelToneClass: Readonly<Record<CefrTone, { soft: string; solid: string; text: string }>> = {
  teal: { soft: "bg-tile-teal", solid: "bg-icon-teal", text: "text-icon-teal" },
  brand: { soft: "bg-tile-brand", solid: "bg-icon-brand", text: "text-icon-brand" },
  orange: { soft: "bg-tile-orange", solid: "bg-icon-orange", text: "text-icon-orange" },
  blue: { soft: "bg-tile-blue", solid: "bg-icon-blue", text: "text-icon-blue" },
  purple: { soft: "bg-tile-purple", solid: "bg-icon-purple", text: "text-icon-purple" },
  pink: { soft: "bg-tile-pink", solid: "bg-icon-pink", text: "text-icon-pink" },
  neutral: { soft: "bg-fill-muted", solid: "bg-fg-subtle", text: "text-fg-muted" },
};

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
