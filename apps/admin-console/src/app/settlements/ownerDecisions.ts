/**
 * Settlement rules still waiting for an owner decision. The admin console
 * shows where they bite so Finance can raise the numbers, without changing
 * the calculation itself. Pure (no "@/…" imports) so vitest can load it.
 */

/**
 * Negative totals (clawback larger than earnings) are paid as 0 and NOT
 * carried forward: the uncollected part is simply lost.
 */
export function uncollectedClawback(lines: Array<{ grossPayoutSatang: string }>): {
  count: number;
  totalSatang: string;
} {
  let count = 0;
  let total = BigInt(0);
  for (const line of lines) {
    let gross: bigint;
    try {
      gross = BigInt(line.grossPayoutSatang);
    } catch {
      continue;
    }
    if (gross < BigInt(0)) {
      count += 1;
      total += -gross;
    }
  }
  return { count, totalSatang: total.toString() };
}

/**
 * A refund/chargeback clawback in a later period both reclaims commission
 * and lowers that period's volume, which may claw the same refund twice.
 */
export function isCrossPeriodRefundClawback(adjustment: {
  reason: string;
  amountSatang: number;
  volumeSatang?: number | null;
}): boolean {
  return (
    /(refund|chargeback)/i.test(adjustment.reason) &&
    adjustment.amountSatang !== 0 &&
    typeof adjustment.volumeSatang === "number" &&
    adjustment.volumeSatang !== 0
  );
}
