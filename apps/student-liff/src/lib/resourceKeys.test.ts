import { afterEach, describe, expect, it, vi } from "vitest";

const getDashboard = vi.fn();
vi.mock("./api", () => ({ studentApi: { getDashboard: (...args: unknown[]) => getDashboard(...args) } }));

import {
  dashboardResourceKey,
  fetchDashboardSummary,
  getTodayHistoryRange,
  progressResourceKey,
  progressResourcePrefix,
} from "./resourceKeys";

describe("resource keys", () => {
  it("scopes the dashboard key to the student", () => {
    expect(dashboardResourceKey("U123")).toBe("U123:dashboard");
  });

  it("builds progress keys under one prefix", () => {
    expect(progressResourcePrefix("U1")).toBe("U1:progress:");
    expect(progressResourceKey("U1")).toBe("U1:progress:auto:auto");
    expect(progressResourceKey("U1", "c1", null)).toBe("U1:progress:c1:auto");
    expect(progressResourceKey("U1", "c1", "b2")).toBe("U1:progress:c1:b2");
    expect(progressResourceKey("U1", "c1", "b2").startsWith(progressResourcePrefix("U1"))).toBe(true);
  });

  it("does not collide with another student's prefix", () => {
    expect(progressResourceKey("U1").startsWith(progressResourcePrefix("U12"))).toBe(false);
  });
});

describe("getTodayHistoryRange", () => {
  it("spans local midnight to the next local midnight", () => {
    const now = new Date(2026, 9, 2, 15, 30, 12);
    const { historyFrom, historyTo } = getTodayHistoryRange(now);
    expect(historyFrom).toBe(new Date(2026, 9, 2).toISOString());
    expect(historyTo).toBe(new Date(2026, 9, 3).toISOString());
  });

  it("rolls over month ends", () => {
    const { historyTo } = getTodayHistoryRange(new Date(2026, 9, 31, 23, 59));
    expect(historyTo).toBe(new Date(2026, 10, 1).toISOString());
  });
});

describe("fetchDashboardSummary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests today's history range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 2, 9, 0));
    getDashboard.mockResolvedValueOnce({ unreadMessages: 0 });
    await expect(fetchDashboardSummary()).resolves.toEqual({ unreadMessages: 0 });
    expect(getDashboard).toHaveBeenCalledWith({
      historyFrom: new Date(2026, 9, 2).toISOString(),
      historyTo: new Date(2026, 9, 3).toISOString(),
    });
  });
});
