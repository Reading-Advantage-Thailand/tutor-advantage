import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  couponStatus,
  dateKeyToExpiryIso,
  dateKeyToParts,
  expiryIsoToDateKey,
  partsToDateKey,
  validateCouponForm,
} from "./couponForm";

const messages = {
  hoursInteger: "hours",
  noteTooLong: "note",
  expiryIncomplete: "incomplete",
  expiryInvalid: "invalid",
  expiryPast: "past",
};
// 2 Oct 2026 10:00 Bangkok
const now = new Date("2026-10-02T03:00:00Z");
const base = { hours: "10", note: "", tutor: null, expiry: { day: "", month: "", yearBE: "" } };

describe("coupon expiry (Buddhist era, Bangkok end of day)", () => {
  it("converts BE parts to a Gregorian key and back", () => {
    expect(partsToDateKey({ day: "31", month: "10", yearBE: "2569" })).toBe("2026-10-31");
    expect(dateKeyToParts("2026-10-31")).toEqual({ day: "31", month: "10", yearBE: "2569" });
    expect(partsToDateKey({ day: "29", month: "2", yearBE: "2569" })).toBeNull(); // 2026 is not a leap year
    expect(partsToDateKey({ day: "29", month: "2", yearBE: "2571" })).toBe("2028-02-29");
    expect(partsToDateKey({ day: "", month: "2", yearBE: "2569" })).toBeNull();
  });

  it("expires at 23:59:59.999 Bangkok time, not midnight UTC", () => {
    expect(dateKeyToExpiryIso("2026-10-31")).toBe("2026-10-31T16:59:59.999Z");
    expect(expiryIsoToDateKey("2026-10-31T16:59:59.999Z")).toBe("2026-10-31");
    expect(expiryIsoToDateKey(null)).toBeNull();
  });

  it("adds days in Bangkok time", () => {
    expect(addDaysKey(0, new Date("2026-10-01T18:00:00Z"))).toBe("2026-10-02");
    expect(addDaysKey(30, now)).toBe("2026-11-01");
  });
});

describe("validateCouponForm", () => {
  it("requires whole hours 1–1000 on create", () => {
    for (const hours of ["", "0", "1.5", "-3", "1001", "abc"]) {
      expect(validateCouponForm({ ...base, hours }, messages, { now }).errors.hours).toBe("hours");
    }
    expect(validateCouponForm({ ...base, hours: " 12 " }, messages, { now }).body).toEqual({ hours: 12 });
  });

  it("validates note length and expiry", () => {
    expect(validateCouponForm({ ...base, note: "x".repeat(501) }, messages, { now }).errors.note).toBe("note");
    expect(
      validateCouponForm({ ...base, expiry: { day: "1", month: "", yearBE: "2569" } }, messages, { now }).errors.expiry,
    ).toBe("incomplete");
    expect(
      validateCouponForm({ ...base, expiry: { day: "1", month: "10", yearBE: "2569" } }, messages, { now }).errors.expiry,
    ).toBe("past");
    expect(
      validateCouponForm({ ...base, expiry: { day: "31", month: "9", yearBE: "2569" } }, messages, { now }).errors.expiry,
    ).toBe("invalid");
  });

  it("builds the create body (today is allowed)", () => {
    const result = validateCouponForm(
      {
        hours: "5",
        note: " แคมเปญ ",
        tutor: { userId: "t1", displayName: "ครูเอ" },
        expiry: { day: "2", month: "10", yearBE: "2569" },
      },
      messages,
      { now },
    );
    expect(result.body).toEqual({
      hours: 5,
      note: "แคมเปญ",
      assignedTutorId: "t1",
      expiresAt: "2026-10-02T16:59:59.999Z",
    });
  });

  it("edit mode ignores hours and sends explicit nulls to clear fields", () => {
    const result = validateCouponForm({ ...base, hours: "" }, messages, { mode: "edit", now });
    expect(result.body).toEqual({ note: null, expiresAt: null, assignedTutorId: null });
  });

  it("uses the effective status when present", () => {
    expect(couponStatus({ status: "ACTIVE", effectiveStatus: "EXPIRED" })).toBe("EXPIRED");
    expect(couponStatus({ status: "VOID" })).toBe("VOID");
  });
});
