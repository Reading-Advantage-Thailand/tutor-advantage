"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { useCachedResource, type CachedResource } from "@/lib/cachedResource";
import type { NavBadgeKey } from "@/lib/routes";
import { ADMIN_SUMMARY_POLL_MS } from "./constants";
import { SummaryContext } from "./adminSummaryContext";
import { useAdminSession } from "./ShellContext";

export { useRefreshAdminSummary } from "./adminSummaryContext";

/** GET /v1/admin/overview (finance). */
export interface AdminOverview {
  stats: {
    totalSettlementsLast30Days: number;
    pendingApprovals: number;
    pendingAdjustments: number;
    pendingVerificationUsers: number;
    unresolvedExceptions: number;
    activeFraudFlags: number;
  };
  workQueues: Record<NavBadgeKey, number>;
  recentActivity: Array<{
    auditId: string;
    actionType: string;
    actorUserId: string | null;
    targetId: string | null;
    entityType: string | null;
    periodMonth?: string | null;
    createdAt: string;
  }>;
  [key: string]: unknown;
}

export const EMPTY_QUEUES: Record<NavBadgeKey, number> = {
  settlements: 0,
  adjustments: 0,
  verifications: 0,
  exceptions: 0,
  fraudFlags: 0,
};

export function overviewKey(userId: string) {
  return `${userId}:admin:overview`;
}

/**
 * The overview resource (shared cache key). The shell already keeps it fresh,
 * so pages (e.g. "/") read it with this hook instead of fetching again:
 * one request per minute app-wide, deduped.
 */
export function useAdminOverview(): CachedResource<AdminOverview> {
  const user = useAdminSession();
  return useCachedResource(user ? overviewKey(user.userId) : null, () => api.get<AdminOverview>("/v1/admin/overview"), {
    staleTime: ADMIN_SUMMARY_POLL_MS / 2,
  });
}

/**
 * The ONE poller for /v1/admin/overview (mounted by AdminShell). Visibility
 * aware: pauses in background tabs and refreshes immediately when the tab
 * becomes visible again. Feeds nav badges and the overview page.
 */
export function AdminSummaryProvider({ children }: { children: ReactNode }) {
  const resource = useAdminOverview();
  const { refetch } = resource;
  const poll = useCallback(() => refetch(), [refetch]);
  // useCachedResource already fetched on mount, so wait one interval first.
  const { runNow } = usePolling(poll, { interval: ADMIN_SUMMARY_POLL_MS, immediate: false });
  const value = useMemo(() => ({ refresh: runNow }), [runNow]);
  return <SummaryContext.Provider value={value}>{children}</SummaryContext.Provider>;
}

/** Work-queue counts for badges (zeros while loading or on error). */
export function useWorkQueues(): Record<NavBadgeKey, number> {
  const { data } = useAdminOverview();
  return data?.workQueues ?? EMPTY_QUEUES;
}
