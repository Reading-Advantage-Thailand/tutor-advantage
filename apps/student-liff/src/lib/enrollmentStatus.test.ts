import { describe, expect, it } from "vitest";
import {
  buildEnrollmentHref,
  buildPaymentHref,
  formatLevelLabel,
  getEnrollmentKey,
  getPrimaryClass,
  getShareableClasses,
  groupEnrollments,
  hasNextSession,
  isPendingPayment,
  type Enrollment,
} from "./enrollmentStatus";

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

describe("isPendingPayment", () => {
  it.each([
    ["pending", true],
    ["PENDING_PAYMENT", true],
    ["payment_pending", true],
    ["awaiting_payment", true],
    ["unpaid", true],
    ["Payment_Required", true],
    ["active", false],
    ["open", false],
    ["completed", false],
    ["awaiting_payment_review", false],
    ["", false],
  ])("%s → %s", (status, expected) => {
    expect(isPendingPayment(status)).toBe(expected);
  });

  it("treats a missing status as not pending", () => {
    expect(isPendingPayment(undefined)).toBe(false);
    expect(isPendingPayment(null)).toBe(false);
  });
});

describe("buildPaymentHref", () => {
  it("adds classId and cycleId", () => {
    expect(buildPaymentHref({ id: "c1", cycleId: "y9" })).toBe("/payment?classId=c1&cycleId=y9");
  });

  it("omits cycleId when absent", () => {
    expect(buildPaymentHref({ id: "c1" })).toBe("/payment?classId=c1");
  });

  it("falls back to /payment without a class id", () => {
    expect(buildPaymentHref({ cycleId: "y9" })).toBe("/payment");
  });
});

describe("buildEnrollmentHref", () => {
  it("sends a pending class to checkout", () => {
    expect(buildEnrollmentHref(enrollment({ status: "pending", cycleId: "y1" }))).toBe(
      "/payment?classId=class-1&cycleId=y1",
    );
  });

  it("sends an active class to its lesson lobby", () => {
    expect(buildEnrollmentHref(enrollment())).toBe("/lesson/class-1");
  });

  it("sends a class without id to /classes (pending or not)", () => {
    expect(buildEnrollmentHref(enrollment({ id: undefined }))).toBe("/classes");
    expect(buildEnrollmentHref(enrollment({ id: undefined, status: "unpaid" }))).toBe("/classes");
  });
});

describe("groupEnrollments", () => {
  it("splits active and pending, keeping order", () => {
    const a = enrollment({ id: "a" });
    const p = enrollment({ id: "p", status: "awaiting_payment" });
    const b = enrollment({ id: "b", status: "open" });
    const groups = groupEnrollments({ recentClasses: [a, p, b] });
    expect(groups.all).toEqual([a, p, b]);
    expect(groups.active).toEqual([a, b]);
    expect(groups.pending).toEqual([p]);
  });

  it("handles missing data", () => {
    expect(groupEnrollments(null)).toEqual({ all: [], active: [], pending: [] });
  });
});

describe("getShareableClasses", () => {
  it("uses shareableClasses from the server when present, minus pending/id-less", () => {
    const ok = enrollment({ id: "ok" });
    const result = getShareableClasses({
      recentClasses: [enrollment({ id: "ignored" })],
      shareableClasses: [ok, enrollment({ id: "x", status: "pending" }), enrollment({ id: undefined })],
    });
    expect(result).toEqual([ok]);
  });

  it("falls back to the active recent classes", () => {
    const a = enrollment({ id: "a" });
    const result = getShareableClasses({
      recentClasses: [a, enrollment({ id: "p", status: "unpaid" }), enrollment({ id: undefined })],
    });
    expect(result).toEqual([a]);
  });

  it("keeps an empty server list empty (no fallback)", () => {
    expect(getShareableClasses({ recentClasses: [enrollment()], shareableClasses: [] })).toEqual([]);
  });
});

describe("getPrimaryClass", () => {
  it("prefers a live class, even a pending one", () => {
    const first = enrollment({ id: "first" });
    const live = enrollment({ id: "live", isLive: true, status: "pending" });
    expect(getPrimaryClass({ recentClasses: [first, live] })).toBe(live);
  });

  it("falls back to the first active class, skipping pending ones", () => {
    const pending = enrollment({ id: "p", status: "pending" });
    const active = enrollment({ id: "a" });
    expect(getPrimaryClass({ recentClasses: [pending, active] })).toBe(active);
  });

  it("returns null without any active class", () => {
    expect(getPrimaryClass({ recentClasses: [enrollment({ status: "pending" })] })).toBeNull();
    expect(getPrimaryClass(undefined)).toBeNull();
  });
});

describe("hasNextSession", () => {
  it("rejects empty and '-' labels", () => {
    expect(hasNextSession({ nextSession: "เสาร์ 10:00" })).toBe(true);
    expect(hasNextSession({ nextSession: "-" })).toBe(false);
    expect(hasNextSession({ nextSession: "" })).toBe(false);
  });
});

describe("formatLevelLabel", () => {
  it("returns null without a book (no fake default level)", () => {
    expect(formatLevelLabel(null)).toBeNull();
    expect(formatLevelLabel({ bookName: null, seriesCefr: "A1" })).toBeNull();
    expect(formatLevelLabel({ bookName: "  ", seriesCefr: "A1" })).toBeNull();
  });

  it("does not repeat a CEFR level already in the book name", () => {
    expect(formatLevelLabel({ bookName: "Primary Origins 3.1 (A0)", seriesCefr: "A0" })).toBe(
      "Primary Origins 3.1 (A0)",
    );
  });

  it("appends the CEFR level otherwise", () => {
    expect(formatLevelLabel({ bookName: "Reading 3.1", seriesCefr: "A1" })).toBe("Reading 3.1 · A1");
    expect(formatLevelLabel({ bookName: "Reading 3.1", seriesCefr: null })).toBe("Reading 3.1");
  });
});

describe("getEnrollmentKey", () => {
  it("is unique per position and stable", () => {
    const e = enrollment({ cycleId: "y" });
    expect(getEnrollmentKey(e, 0)).toBe("class-1:y:active:Reading 3.1:0");
    expect(getEnrollmentKey(enrollment({ id: undefined, bookName: null }), 2)).toBe("class:base:active:Reading A:2");
  });
});
