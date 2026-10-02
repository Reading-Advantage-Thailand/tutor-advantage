/**
 * Pure helpers for the Classes tab (catalog list). No React and no "@/"
 * imports, so vitest (whose "@" alias points at another app) can load it.
 */

/** One card from GET /classes/available. */
export interface ClassListItem {
  id: string;
  name: string;
  status: string;
  seriesColor?: string;
  capacity: number;
  enrolled: number;
  tutor: string;
  tutorInitials: string;
  cefr: string;
  level: number;
  nextSession: string;
  price: number;
}

export interface ClassListResponse {
  classes?: ClassListItem[];
}

/** Group prefix of every catalog query of one student (for invalidation). */
export function classesResourcePrefix(userId: string): string {
  return `${userId}:classes:`;
}

/**
 * Cache key per (cefr, q) so switching back to a filter shows its results
 * instantly. `q` is kept exactly as typed — it is sent to the API unchanged.
 */
export function classesResourceKey(userId: string, query: string, cefr: string | null): string {
  return `${classesResourcePrefix(userId)}${cefr ?? "*"}:${query}`;
}

/** Typing waits this long before searching. */
export const SEARCH_DEBOUNCE_MS = 400;

/**
 * Debounce delay for the search text. An emptied box settles at once, so the
 * debounced value forgets the old text: otherwise typing a new letter within
 * the delay after clearing would briefly bring back the old search results.
 */
export function searchDebounceDelay(typed: string): number {
  return typed === "" ? 0 : SEARCH_DEBOUNCE_MS;
}

/**
 * The query to fetch with: an emptied search box applies immediately (no
 * debounce), otherwise the debounced text.
 */
export function resolveSearchQuery(typed: string, debounced: string): string {
  return typed === "" ? "" : debounced;
}

/** True when a search or level filter narrows the catalog (empty state copy + "clear filters"). */
export function isClassFilterActive(query: string, cefr: string | null): boolean {
  return Boolean(query) || cefr !== null;
}

/** Status pill for a card. Open classes need no pill (the whole catalog is open). */
export function getClassStatusBadge(status: string): "full" | "closed" | null {
  if (status === "full") return "full";
  if (status === "closed") return "closed";
  return null;
}
