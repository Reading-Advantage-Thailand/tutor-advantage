import { describe, expect, it } from "vitest";
import {
  articleReadHref,
  classArticlesResourceKey,
  classDetailResourceKey,
  classReviewResourceKey,
  classifyClassLoadError,
  deriveClassAccess,
  getArticleRowHref,
  getClassPrimaryAction,
  getLessonListFooter,
  getSeatInfo,
  lessonLobbyHref,
  paymentHref,
  pickDefaultCycleId,
  resolveSelectedCycleId,
  type ClassAccessSource,
  type ClassBookCycle,
} from "./classAccess";

const cycle = (id: string, sequence: number, hasAccess: boolean, price = 2500): ClassBookCycle => ({
  id,
  title: `Book ${sequence}`,
  sequence,
  price,
  hasAccess,
});

const base: ClassAccessSource = {
  id: "class-1",
  status: "open",
  price: 1990,
  isEnrolled: false,
  activeBookCycleId: "c2",
  bookCycles: [cycle("c1", 1, false), cycle("c2", 2, false, 3000)],
};

describe("pickDefaultCycleId", () => {
  it("prefers the newest cycle with access", () => {
    expect(
      pickDefaultCycleId({ activeBookCycleId: "c3", bookCycles: [cycle("c1", 1, true), cycle("c2", 2, true), cycle("c3", 3, false)] }),
    ).toBe("c2");
  });

  it("falls back to the active cycle, then the first, then empty", () => {
    expect(pickDefaultCycleId(base)).toBe("c2");
    expect(pickDefaultCycleId({ activeBookCycleId: "missing", bookCycles: base.bookCycles })).toBe("c1");
    expect(pickDefaultCycleId({ activeBookCycleId: null, bookCycles: [] })).toBe("");
    expect(pickDefaultCycleId({})).toBe("");
  });
});

describe("resolveSelectedCycleId", () => {
  it("keeps a valid user pick and ignores a stale one", () => {
    expect(resolveSelectedCycleId(base, "c1")).toBe("c1");
    expect(resolveSelectedCycleId(base, "gone")).toBe("c2");
    expect(resolveSelectedCycleId(base, null)).toBe("c2");
  });
});

describe("deriveClassAccess", () => {
  it("locks everything for a visitor", () => {
    const access = deriveClassAccess(base, "c2");
    expect(access).toMatchObject({
      canReview: false,
      needsUpgrade: false,
      canReadSelectedCycle: false,
      selectedCycleLocked: true,
      footerPrice: 1990,
    });
    expect(access.activeCycle?.id).toBe("c2");
  });

  it("flags an upgrade when the enrolled student lacks the active book", () => {
    const cls = { ...base, isEnrolled: true, bookCycles: [cycle("c1", 1, true), cycle("c2", 2, false, 3000)] };
    const onOld = deriveClassAccess(cls, "c1");
    expect(onOld).toMatchObject({ needsUpgrade: true, canReadSelectedCycle: true, selectedCycleLocked: false, footerPrice: 3000 });
    const onNew = deriveClassAccess(cls, "c2");
    expect(onNew).toMatchObject({ canReadSelectedCycle: false, selectedCycleLocked: true });
  });

  it("lets an enrolled student read when the class has no cycles", () => {
    const access = deriveClassAccess({ ...base, isEnrolled: true, bookCycles: undefined, activeBookCycleId: null }, "");
    expect(access).toMatchObject({ canReadSelectedCycle: true, selectedCycleLocked: false, needsUpgrade: false, footerPrice: 1990 });
  });

  it("allows reviews only for enrolled students of closed classes", () => {
    expect(deriveClassAccess({ ...base, status: "closed" }, "c2").canReview).toBe(false);
    expect(deriveClassAccess({ ...base, status: "closed", isEnrolled: true }, "c2").canReview).toBe(true);
  });
});

describe("getClassPrimaryAction", () => {
  it("routes upgrade → payment with cycleId", () => {
    const cls = { ...base, isEnrolled: true, bookCycles: [cycle("c1", 1, true), cycle("c2", 2, false, 3000)] };
    expect(getClassPrimaryAction(cls, deriveClassAccess(cls, "c1"))).toEqual({
      kind: "upgrade",
      href: "/payment?classId=class-1&cycleId=c2",
      cycleSequence: 2,
      price: 3000,
    });
  });

  it("sends enrolled students to the lobby", () => {
    const cls = { ...base, isEnrolled: true, bookCycles: [cycle("c1", 1, true), cycle("c2", 2, true)] };
    expect(getClassPrimaryAction(cls, deriveClassAccess(cls, "c2"))).toEqual({ kind: "enter", href: "/lesson/class-1" });
  });

  it("sends visitors to payment with only classId", () => {
    expect(getClassPrimaryAction(base, deriveClassAccess(base, "c2"))).toEqual({
      kind: "enroll",
      href: "/payment?classId=class-1",
      price: 1990,
      pendingPayment: false,
    });
    const pending = { ...base, enrollmentStatus: "PENDING_PAYMENT" };
    expect(getClassPrimaryAction(pending, deriveClassAccess(pending, "c2"))).toMatchObject({ kind: "enroll", pendingPayment: true });
  });
});

describe("hrefs and seats", () => {
  it("builds the routes", () => {
    expect(paymentHref("a")).toBe("/payment?classId=a");
    expect(paymentHref("a", "b")).toBe("/payment?classId=a&cycleId=b");
    expect(lessonLobbyHref("a b")).toBe("/lesson/a%20b");
    expect(articleReadHref("art-1")).toBe("/student/read/art-1");
  });

  it("clamps seats and guards zero capacity", () => {
    expect(getSeatInfo(4, 30)).toEqual({ seatsLeft: 26, fillPercent: 13, urgent: false });
    expect(getSeatInfo(29, 30)).toEqual({ seatsLeft: 1, fillPercent: 97, urgent: true });
    expect(getSeatInfo(32, 30).seatsLeft).toBe(0);
    expect(getSeatInfo(0, 0)).toEqual({ seatsLeft: 0, fillPercent: 100, urgent: true });
  });
});

describe("lesson rows", () => {
  it("links rows only when the selected book is readable", () => {
    expect(getArticleRowHref("a1", true)).toBe("/student/read/a1");
    expect(getArticleRowHref("a1", false)).toBeUndefined();
  });

  it("shows payment footers only to students who cannot read the book", () => {
    expect(getLessonListFooter(14, 3, false)).toEqual({ kind: "more", remaining: 11 });
    expect(getLessonListFooter(3, 3, false)).toEqual({ kind: "allAfterPayment" });
    expect(getLessonListFooter(0, 0, false)).toBeNull();
    expect(getLessonListFooter(14, 13, true)).toBeNull();
    expect(getLessonListFooter(13, 13, true)).toBeNull();
  });
});

describe("classifyClassLoadError", () => {
  it("maps HTTP status to a screen", () => {
    expect(classifyClassLoadError({ status: 404 })).toBe("notFound");
    expect(classifyClassLoadError({ status: 403 })).toBe("notFound");
    expect(classifyClassLoadError({ status: 500 })).toBe("error");
    expect(classifyClassLoadError(new TypeError("Failed to fetch"))).toBe("offline");
    expect(classifyClassLoadError(null)).toBe("offline");
  });
});

describe("cache keys", () => {
  it("nests articles and review under the class key", () => {
    expect(classDetailResourceKey("u", "c")).toBe("u:class:c");
    expect(classArticlesResourceKey("u", "c", "cy")).toBe("u:class:c:articles:cy");
    expect(classArticlesResourceKey("u", "c", "")).toBe("u:class:c:articles:");
    expect(classReviewResourceKey("u", "c")).toBe("u:class:c:review");
  });
});
