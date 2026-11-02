import { describe, expect, it } from "vitest";
import type { AdminClass } from "../classes/classForm";
import {
  isVoidable,
  listQuery,
  readCreateRequest,
  validateDiscountCodeForm,
  withoutCreateParam,
} from "./discountCodeForm";

const messages = {
  classRequired: "class",
  classDemo: "demo",
  maxRedemptions: "max",
  noteTooLong: "note",
  expiryIncomplete: "incomplete",
  expiryInvalid: "invalid",
  expiryPast: "past",
};
// 2 Nov 2026 10:00 Bangkok
const now = new Date("2026-11-02T03:00:00Z");
const classId = "5eed0000-0000-4000-8000-00000000c1a5";
const englishClass: AdminClass = {
  classId,
  title: "English",
  status: "OPEN",
  isDemo: false,
  bookId: "5eed0000-0000-4000-8000-0000000b0001",
  bookCode: "Primary Origins 2",
  bookTitle: "Primary Origins 2 (A1)",
  packagePriceSatang: 300_000,
  capacity: 30,
  enrolledCount: 0,
  activeStudents: 0,
  scheduleDescription: null,
  setupRequired: true,
  setupRequiredAt: "2026-11-02T02:00:00.000Z",
  createdAt: "2026-11-02T02:00:00.000Z",
  tutor: { userId: "t1", displayName: "T.นกเอี้ยง", email: "kasamphon63@gmail.com", pendingRegistration: true },
};
const base = { classOption: englishClass, maxRedemptions: "1", expiry: { day: "", month: "", yearBE: "" }, note: "" };

describe("validateDiscountCodeForm", () => {
  it("builds the minimal body: one use, no expiry, no note", () => {
    expect(validateDiscountCodeForm(base, messages, { now })).toEqual({ errors: {}, body: { classId, maxRedemptions: 1 } });
  });

  it("sends the Bangkok end of day as expiry and a trimmed note", () => {
    const result = validateDiscountCodeForm(
      { ...base, maxRedemptions: " 25 ", note: " โอนเงินแล้ว ", expiry: { day: "2", month: "11", yearBE: "2569" } },
      messages,
      { now },
    );
    expect(result.body).toEqual({
      classId,
      maxRedemptions: 25,
      expiresAt: "2026-11-02T16:59:59.999Z",
      note: "โอนเงินแล้ว",
    });
  });

  it("requires a non-demo class", () => {
    expect(validateDiscountCodeForm({ ...base, classOption: null }, messages, { now })).toEqual({
      errors: { class: "class" },
      body: null,
    });
    expect(validateDiscountCodeForm({ ...base, classOption: { ...englishClass, isDemo: true } }, messages, { now }).errors.class).toBe(
      "demo",
    );
  });

  it("limits uses to whole numbers 1–500", () => {
    for (const maxRedemptions of ["", "0", "1.5", "-1", "501", "abc"]) {
      expect(validateDiscountCodeForm({ ...base, maxRedemptions }, messages, { now }).errors.maxRedemptions, maxRedemptions).toBe("max");
    }
    expect(validateDiscountCodeForm({ ...base, maxRedemptions: "500" }, messages, { now }).body?.maxRedemptions).toBe(500);
  });

  it("validates note length and expiry", () => {
    expect(validateDiscountCodeForm({ ...base, note: "x".repeat(501) }, messages, { now }).errors.note).toBe("note");
    expect(
      validateDiscountCodeForm({ ...base, expiry: { day: "1", month: "11", yearBE: "2569" } }, messages, { now }).errors.expiry,
    ).toBe("past");
    expect(
      validateDiscountCodeForm({ ...base, expiry: { day: "1", month: "", yearBE: "2569" } }, messages, { now }).errors.expiry,
    ).toBe("incomplete");
  });
});

describe("deep link from /classes", () => {
  it("reads ?create=1&classId= and ignores a non-UUID class id", () => {
    expect(readCreateRequest(new URLSearchParams(`create=1&classId=${classId}`))).toEqual({ classId });
    expect(readCreateRequest(new URLSearchParams("create=1&classId=../x"))).toEqual({ classId: null });
    expect(readCreateRequest(new URLSearchParams(`classId=${classId}`))).toBeNull();
    expect(readCreateRequest(null)).toBeNull();
  });

  it("drops only the create flag so the class filter stays", () => {
    expect(withoutCreateParam(`create=1&classId=${classId}&status=ACTIVE`)).toBe(`classId=${classId}&status=ACTIVE`);
  });
});

describe("list helpers", () => {
  it("never sends a malformed class filter", () => {
    expect(listQuery({ page: 1, classId })).toEqual({ page: 1, classId });
    expect(listQuery({ page: 1, classId: "abc" })).toEqual({ page: 1 });
    expect(listQuery({ page: 2 })).toEqual({ page: 2 });
  });

  it("offers void only while a code can still be used", () => {
    expect(isVoidable({ status: "ACTIVE" })).toBe(true);
    for (const status of ["USED_UP", "EXPIRED", "VOID"] as const) expect(isVoidable({ status })).toBe(false);
  });
});
