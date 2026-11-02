import { describe, expect, it } from "vitest";
import { DISCOUNT_CODE_METHOD, isOmiseIntent } from "./paymentMethods";

describe("isOmiseIntent", () => {
  it("accepts Omise methods in any letter case", () => {
    expect(isOmiseIntent({ method: "promptpay" })).toBe(true);
    expect(isOmiseIntent({ method: "card" })).toBe(true);
    // Legacy rows were written as "PROMPTPAY".
    expect(isOmiseIntent({ method: "PROMPTPAY" })).toBe(true);
  });

  it("rejects discount code and other non-Omise payments", () => {
    expect(isOmiseIntent({ method: DISCOUNT_CODE_METHOD })).toBe(false);
    expect(isOmiseIntent({ method: "DEV" })).toBe(false);
    expect(isOmiseIntent({ method: null })).toBe(false);
    expect(isOmiseIntent({})).toBe(false);
  });
});
