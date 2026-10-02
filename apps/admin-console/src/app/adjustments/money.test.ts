import { describe, expect, it } from "vitest";
import { parseBahtToSatang } from "./money";

describe("parseBahtToSatang", () => {
  it("parses baht with thousands separators exactly (no parseFloat truncation)", () => {
    expect(parseBahtToSatang("1,000")).toBe(100_000);
    expect(parseBahtToSatang("1,500.5")).toBe(150_050);
    expect(parseBahtToSatang("฿ 300.25")).toBe(30_025);
    expect(parseBahtToSatang("0.01")).toBe(1);
  });

  it("rejects zero, negatives, too many decimals and junk", () => {
    expect(parseBahtToSatang("0")).toBeNull();
    expect(parseBahtToSatang("-5")).toBeNull();
    expect(parseBahtToSatang("1.005")).toBeNull();
    expect(parseBahtToSatang("1e3")).toBeNull();
    expect(parseBahtToSatang("")).toBeNull();
  });
});
