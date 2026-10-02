import { describe, expect, it } from "vitest";
import { fillTemplate, formatRatePercent } from "./text";

describe("formatRatePercent", () => {
  it("drops float noise and trailing zeros", () => {
    expect(formatRatePercent(0.43)).toBe("43%");
    expect(formatRatePercent(0.425)).toBe("42.5%");
    expect(formatRatePercent(0.1234)).toBe("12.34%");
    expect(formatRatePercent(undefined)).toBe("0%");
  });
});

describe("fillTemplate", () => {
  it("replaces known placeholders only", () => {
    expect(fillTemplate("ถูก {correct} จาก {total}", { correct: 3, total: 5 })).toBe("ถูก 3 จาก 5");
    expect(fillTemplate("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});
