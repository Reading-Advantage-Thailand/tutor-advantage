import { describe, expect, it } from "vitest";
import {
  buildPayoutDocumentNumber,
  buildReceiptNumber,
  calculateVatInclusive,
  calculateWithholdingTax,
} from "./taxService";

describe("taxService", () => {
  it("splits VAT-inclusive gross amount into VAT and net portions", () => {
    expect(calculateVatInclusive(107_00n)).toEqual({
      grossAmountMinor: 107_00n,
      vatAmountMinor: 700n,
      netAmountMinor: 100_00n,
    });
  });

  it("calculates withholding tax and net payout", () => {
    expect(calculateWithholdingTax(10_000n)).toEqual({
      grossPayoutMinor: 10_000n,
      withholdingTaxMinor: 300n,
      netPayoutMinor: 9_700n,
    });
  });

  it("builds deterministic receipt and payout document numbers", () => {
    const issuedAt = new Date("2026-05-14T12:00:00.000Z");

    expect(buildReceiptNumber("pi_1234567890", issuedAt)).toBe("RCT-20260514-pi_12345");
    expect(buildPayoutDocumentNumber("line_abcdefghi", issuedAt)).toBe("50TAWI-20260514-line_abc");
  });
});
