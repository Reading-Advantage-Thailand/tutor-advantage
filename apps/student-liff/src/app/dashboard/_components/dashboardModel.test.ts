import { describe, expect, it } from "vitest";
import type { DashboardSummary, Enrollment } from "../../../lib/enrollmentStatus";
import { deriveHomeModel, formatBadgeCount, getGreetingKey, shouldPlayUnreadChime } from "./dashboardModel";

function enrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: "class-1",
    name: "Reading A",
    tutorName: "Kru A",
    status: "active",
    nextSession: "เสาร์ 10:00",
    progress: 40,
    bookName: "Reading 3.1",
    seriesCefr: "A1",
    ...overrides,
  };
}

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return { unreadMessages: 0, weekStreak: 0, activeEnrollments: 0, recentClasses: [], ...overrides };
}

describe("getGreetingKey", () => {
  it.each([
    [0, "dashboard.morning"],
    [11, "dashboard.morning"],
    [12, "dashboard.afternoon"],
    [16, "dashboard.afternoon"],
    [17, "dashboard.evening"],
    [23, "dashboard.evening"],
  ])("hour %i → %s", (hour, key) => {
    expect(getGreetingKey(hour)).toBe(key);
  });
});

describe("shouldPlayUnreadChime", () => {
  it("never chimes for the first value seen (cache hit on tab revisit)", () => {
    expect(shouldPlayUnreadChime(undefined, 5)).toBe(false);
  });

  it("chimes only when the count increases", () => {
    expect(shouldPlayUnreadChime(2, 3)).toBe(true);
    expect(shouldPlayUnreadChime(3, 3)).toBe(false);
    expect(shouldPlayUnreadChime(3, 0)).toBe(false);
  });

  it("ignores missing data", () => {
    expect(shouldPlayUnreadChime(3, undefined)).toBe(false);
  });
});

describe("formatBadgeCount", () => {
  it("caps at 99+", () => {
    expect(formatBadgeCount(7)).toBe("7");
    expect(formatBadgeCount(99)).toBe("99");
    expect(formatBadgeCount(100)).toBe("99+");
  });
});

describe("deriveHomeModel", () => {
  it("is empty without data", () => {
    const model = deriveHomeModel(undefined);
    expect(model.isEmpty).toBe(true);
    expect(model.primary).toBeNull();
    expect(model.nextUpKind).toBeNull();
    expect(model.levelLabel).toBeNull();
    expect(model.unread).toBe(0);
    expect(model.todayHistory).toEqual([]);
  });

  it("features the first paid class as upcoming and keeps pending out of my classes", () => {
    const pending = enrollment({ id: "p", status: "awaiting_payment", price: 1500 });
    const active = enrollment({ id: "a", status: "open" });
    const model = deriveHomeModel(
      summary({ recentClasses: [pending, active], unreadMessages: 4, weekStreak: 2, activeEnrollments: 3 }),
    );
    expect(model.classCount).toBe(3);
    expect(model.primary).toBe(active);
    expect(model.nextUpKind).toBe("upcoming");
    expect(model.primaryNeedsPayment).toBe(false);
    expect(model.myClasses).toEqual([active]);
    expect(model.pendingNotice).toEqual([pending]);
    expect(model.unread).toBe(4);
    expect(model.weekStreak).toBe(2);
    expect(model.levelLabel).toBe("Reading 3.1 · A1");
    expect(model.isEmpty).toBe(false);
  });

  it("puts a live class first", () => {
    const active = enrollment({ id: "a" });
    const live = enrollment({ id: "l", isLive: true });
    const model = deriveHomeModel(summary({ recentClasses: [active, live] }));
    expect(model.primary).toBe(live);
    expect(model.nextUpKind).toBe("live");
    expect(model.myClasses).toEqual([active, live]);
  });

  it("does not repeat a live pending class in the payment notice", () => {
    const livePending = enrollment({ id: "lp", isLive: true, status: "pending" });
    const otherPending = enrollment({ id: "p2", status: "unpaid" });
    const model = deriveHomeModel(summary({ recentClasses: [livePending, otherPending] }));
    expect(model.primary).toBe(livePending);
    expect(model.primaryNeedsPayment).toBe(true);
    expect(model.pendingNotice).toEqual([otherPending]);
    expect(model.myClasses).toEqual([]);
  });

  it("has no featured class when everything is pending", () => {
    const pending = enrollment({ status: "pending" });
    const model = deriveHomeModel(summary({ recentClasses: [pending] }));
    expect(model.primary).toBeNull();
    expect(model.nextUpKind).toBeNull();
    expect(model.pendingNotice).toEqual([pending]);
    expect(model.isEmpty).toBe(false);
    expect(model.shareable).toEqual([]);
  });

  it("uses the server's shareable classes", () => {
    const share = enrollment({ id: "s" });
    const model = deriveHomeModel(summary({ recentClasses: [enrollment()], shareableClasses: [share] }));
    expect(model.shareable).toEqual([share]);
  });
});
