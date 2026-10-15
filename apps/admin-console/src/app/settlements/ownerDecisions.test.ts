import { describe, expect, it } from "vitest";
import { uncollectedClawback } from "./ownerDecisions";

describe("uncollectedClawback", () => {
  it("sums the negative totals that are paid as 0", () => {
    expect(
      uncollectedClawback([
        { grossPayoutSatang: "-250000" },
        { grossPayoutSatang: "120000" },
        { grossPayoutSatang: "-5000" },
        { grossPayoutSatang: "oops" },
      ]),
    ).toEqual({ count: 2, totalSatang: "255000" });
    expect(uncollectedClawback([])).toEqual({ count: 0, totalSatang: "0" });
  });
});
