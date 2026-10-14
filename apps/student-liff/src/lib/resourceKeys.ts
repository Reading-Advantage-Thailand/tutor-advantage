/**
 * Shared cache keys (and their fetchers) for useCachedResource, so every
 * screen that reads the same server resource hits the same cache entry.
 *
 * Key convention (see cachedResource.ts): `${userId}:<resource>[:<params>]`.
 * Group prefixes end with ":" because prefix matching is a plain string match.
 *
 * Example: invalidate Home after a payment succeeds:
 *   invalidateResource(dashboardResourceKey(profile.userId));
 */

// Relative import: the root vitest config maps "@" to another app.
import { studentApi } from "./api";
import type { DashboardSummary } from "./enrollmentStatus";

/** Home summary (GET /dashboard/summary with today's history). Also read by Profile. */
export function dashboardResourceKey(userId: string): string {
  return `${userId}:dashboard`;
}

/** Prefix of every progress entry of one student (all classes/books). */
export function progressResourcePrefix(userId: string): string {
  return `${userId}:progress:`;
}

/**
 * Progress for the requested class/book. Empty selection ("auto") lets the
 * server pick its default class and book.
 */
export function progressResourceKey(
  userId: string,
  classId?: string | null,
  cycleId?: string | null,
): string {
  return `${progressResourcePrefix(userId)}${classId || "auto"}:${cycleId || "auto"}`;
}

/** Local-midnight → next-local-midnight ISO range used for Home's "today" history. */
export function getTodayHistoryRange(now: Date = new Date()): { historyFrom: string; historyTo: string } {
  const historyFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const historyTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { historyFrom: historyFrom.toISOString(), historyTo: historyTo.toISOString() };
}

/**
 * The one fetcher for dashboardResourceKey(): always asks for today's history
 * (computed at request time, so it rolls over at midnight). Use it with the key:
 *   useCachedResource(dashboardResourceKey(uid), fetchDashboardSummary, { enabled: isReady })
 */
export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return studentApi.getDashboard(getTodayHistoryRange()) as Promise<DashboardSummary>;
}
