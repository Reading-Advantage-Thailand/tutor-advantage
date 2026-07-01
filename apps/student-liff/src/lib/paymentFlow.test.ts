import { describe, expect, it } from "vitest";
import {
  buildOrderSummaryFromClass,
  createDefaultOrderSummary,
  formatCardExpiry,
  formatCardNumber,
  getReturnedPaymentStep,
  isUnder18,
  isValidDateOfBirth,
  mergeCheckoutDetails,
  parseClassIdFromQrText,
  shouldLoadPromptPayQr,
  type CheckoutDetails,
} from "./paymentFlow";

describe("paymentFlow helpers", () => {
  it("validates dates of birth and distinguishes ages 17 and 18", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");

    expect(isUnder18("2008-07-02", now)).toBe(true);
    expect(isUnder18("2008-07-01", now)).toBe(false);
    expect(isValidDateOfBirth("2027-01-01", now)).toBe(false);
    expect(isValidDateOfBirth("2026-02-30", now)).toBe(false);
  });

  it("builds default and API-backed order summaries", () => {
    expect(createDefaultOrderSummary("class-1")).toMatchObject({
      id: "class-1",
      price: 2500,
      priceSatang: 250000,
    });

    expect(
      buildOrderSummaryFromClass(
        {
          id: "api-class",
          name: "Reading A1",
          book: "Origins",
          packagePriceSatang: 320000,
          tutor: { name: "Teacher Ada" },
        },
        "fallback",
      ),
    ).toEqual({
      id: "api-class",
      name: "Reading A1",
      price: 3200,
      priceSatang: 320000,
      tutor: "Teacher Ada",
      cefr: "Origins",
    });
  });

  it("preserves an existing QR data URI when checkout refresh omits it", () => {
    const current: CheckoutDetails = {
      provider: "omise",
      chargeId: "charge-1",
      status: "pending",
      paid: false,
      authorizeUri: null,
      qrCodeUrl: null,
      qrCodeDataUri: "data:image/png;base64,old",
      failureMessage: null,
    };
    const next: CheckoutDetails = {
      ...current,
      status: "successful",
      paid: true,
      qrCodeDataUri: null,
    };

    expect(mergeCheckoutDetails(current, next)).toMatchObject({
      status: "successful",
      paid: true,
      qrCodeDataUri: "data:image/png;base64,old",
    });
    expect(mergeCheckoutDetails(current, null)).toBe(current);
  });

  it("derives returned payment behavior from intent status and method", () => {
    expect(getReturnedPaymentStep({ status: "SUCCESS" })).toBe("success");
    expect(getReturnedPaymentStep({ status: "PENDING" })).toBe("qr");
    expect(shouldLoadPromptPayQr({ status: "PENDING", method: "promptpay" })).toBe(true);
    expect(shouldLoadPromptPayQr({ status: "SUCCESS", method: "promptpay" })).toBe(false);
    expect(shouldLoadPromptPayQr({ status: "PENDING", method: "card" })).toBe(false);
  });

  it("formats card fields for Omise tokenization forms", () => {
    expect(formatCardNumber("4242abcd4242 4242 424299")).toBe("4242 4242 4242 4242");
    expect(formatCardExpiry("12345")).toBe("12/34");
    expect(formatCardExpiry("1a2b")).toBe("12/");
  });

  it("extracts class IDs from scanned QR text", () => {
    expect(parseClassIdFromQrText("https://app.example.com/enroll?classId=class-1")).toBe("class-1");
    expect(parseClassIdFromQrText("/enroll?token=abc&classId=class%202")).toBe("class 2");
    expect(parseClassIdFromQrText("not a class QR")).toBeNull();
  });
});
