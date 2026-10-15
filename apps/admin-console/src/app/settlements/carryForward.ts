/**
 * Clawback carry-forward helpers for the admin console (owner decision
 * 2026-10-15). Pure (no "@/…" imports) so vitest can load it.
 */

export const CARRY_FORWARD_PREFIX = "carry-forward";
export const CARRY_FORWARD_WRITE_OFF_PREFIX = "carry-forward-writeoff";
export const WRITE_OFF_SUGGESTED_MONTHS = 6;

/** Tutors whose debt rolls into the next period, and the total carried. */
export function carryForwardSummary(lines: Array<{ carryForwardOutSatang?: string | null }>): {
  count: number;
  totalSatang: string;
} {
  let count = 0;
  let total = BigInt(0);
  for (const line of lines) {
    let out: bigint;
    try {
      out = BigInt(line.carryForwardOutSatang ?? "0");
    } catch {
      continue;
    }
    if (out > BigInt(0)) {
      count += 1;
      total += out;
    }
  }
  return { count, totalSatang: total.toString() };
}

/** A system carry-forward debt row (not a write-off), with its origin month. */
export function carryForwardDebt(adjustment: { reason: string; amountSatang: number }): { origin: string | null } | null {
  const reason = adjustment.reason.trim().toLowerCase();
  if (!reason.startsWith(CARRY_FORWARD_PREFIX) || reason.startsWith(CARRY_FORWARD_WRITE_OFF_PREFIX)) return null;
  if (adjustment.amountSatang >= 0) return null;
  return { origin: /origin=(\d{4}-\d{2})/.exec(adjustment.reason)?.[1] ?? null };
}

/** Whole months from `origin` (YYYY-MM) to `current` (YYYY-MM). */
export function monthsBetween(origin: string, current: string): number {
  const [oy, om] = origin.split("-").map(Number);
  const [cy, cm] = current.split("-").map(Number);
  return (cy - oy) * 12 + (cm - om);
}
