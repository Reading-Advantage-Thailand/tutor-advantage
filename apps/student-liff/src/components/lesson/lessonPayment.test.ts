import { describe, expect, it } from "vitest";
import { buildPaymentBackUrl, buildPaymentUrl, getPaymentBookLabel } from "./lessonPayment";

describe("buildPaymentUrl", () => {
  it("prefers the server-provided payment URL", () => {
    expect(buildPaymentUrl({ paymentUrl: "/payment?classId=c1&cycleId=x9", cycleId: "other" }, "c1")).toBe(
      "/payment?classId=c1&cycleId=x9",
    );
  });

  it("builds the class payment URL with the cycle when the server sends none", () => {
    expect(buildPaymentUrl({ paymentUrl: "", cycleId: "cy-1" }, "class-1")).toBe("/payment?classId=class-1&cycleId=cy-1");
  });

  it("omits the cycle when it is missing", () => {
    expect(buildPaymentUrl({ paymentUrl: "", cycleId: null }, "class-1")).toBe("/payment?classId=class-1");
    expect(buildPaymentUrl({ paymentUrl: "" }, "class-1")).toBe("/payment?classId=class-1");
  });

  it("falls back to the bare payment page without a class (live lesson without classId)", () => {
    expect(buildPaymentUrl({ paymentUrl: "", cycleId: "cy-1" }, null)).toBe("/payment");
    expect(buildPaymentUrl({ paymentUrl: "" }, undefined)).toBe("/payment");
  });
});

describe("buildPaymentBackUrl", () => {
  it("goes back to the class page, or home without a class", () => {
    expect(buildPaymentBackUrl("class-1")).toBe("/classes/class-1");
    expect(buildPaymentBackUrl(null)).toBe("/dashboard");
    expect(buildPaymentBackUrl("")).toBe("/dashboard");
  });
});

describe("getPaymentBookLabel", () => {
  it("joins code and title", () => {
    expect(getPaymentBookLabel({ bookCode: "RA 3.1", bookTitle: "Origins" })).toBe("RA 3.1: Origins");
  });
  it("uses whichever part exists", () => {
    expect(getPaymentBookLabel({ bookCode: null, bookTitle: "Origins" })).toBe("Origins");
    expect(getPaymentBookLabel({ bookCode: "RA 3.1" })).toBe("RA 3.1");
  });
  it("returns null when there is nothing to show", () => {
    expect(getPaymentBookLabel({ bookCode: "", bookTitle: null })).toBeNull();
  });
});
