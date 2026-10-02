"use client";

import { createContext, useContext } from "react";

/**
 * Refresh handle for the shell's admin-summary poller (provided by
 * AdminSummaryProvider). Kept apart from AdminSummary.tsx so pages that only
 * refresh badges don't bundle the poller/overview resource code again.
 */
export const SummaryContext = createContext<{ refresh: () => Promise<void> }>({ refresh: async () => {} });

/** Refresh the summary now (call after approving/resolving something that changes a queue). */
export function useRefreshAdminSummary(): () => Promise<void> {
  return useContext(SummaryContext).refresh;
}
