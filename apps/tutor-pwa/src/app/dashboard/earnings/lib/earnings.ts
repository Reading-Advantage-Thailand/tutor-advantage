/**
 * Pure earnings helpers (no React, no fetch). Business rules mirror the
 * finance service; keep them in sync with `calculateWithholdingTax`.
 */
import { formatThaiMonthYear } from "@/lib/format";

export type EarningsAdjustment = { amount: number; reason: string };

export type PayoutDocumentSummary = {
  payoutDocumentId: string;
  documentNumber: string;
  documentType: string;
  status: string;
  issuedAt: string;
  transferStatus?: string;
  transferredAt?: string | null;
};

export type EarningsHistoryItem = {
  date: string;
  payoutLineId?: string;
  direct: number;
  network: number;
  badgeBonus?: number;
  clawback: number;
  adjustments?: EarningsAdjustment[];
  withholdingTax?: number;
  netPayout?: number;
  payoutDocument?: PayoutDocumentSummary | null;
  status: string;
};

export type EarningsProjection = {
  directSales: number;
  networkBonus: number;
  badgeBonus?: number;
  clawback: number;
  adjustments?: EarningsAdjustment[];
  total: number;
};

export type RateInfo = { rate: number; volume: number; nextTarget: number };

export type EarningsResponse = {
  periodMonth: string;
  currentProjection: EarningsProjection;
  history: EarningsHistoryItem[];
  clawbacks: { date: string; amount: number; reason: string }[];
  rateInfo: RateInfo;
};

export const EMPTY_PROJECTION: EarningsProjection = {
  directSales: 0,
  networkBonus: 0,
  badgeBonus: 0,
  clawback: 0,
  total: 0,
};

export const EMPTY_RATE_INFO: RateInfo = { rate: 0, volume: 0, nextTarget: 0 };

/**
 * WHT for the current projection, satang-precise to mirror the backend
 * calculateWithholdingTax: (grossMinor * 3 + 50) / 100 with integer (floor)
 * division, matching BigInt arithmetic.
 */
export function projectWithholding(gross: number): { gross: number; wht: number; net: number } {
  const grossMinor = Math.round(gross * 100);
  const whtMinor = grossMinor > 0 ? Math.floor((grossMinor * 3 + 50) / 100) : 0;
  return { gross, wht: whtMinor / 100, net: (grossMinor - whtMinor) / 100 };
}

/** Commission rate as a percentage with 2 decimals (matches the admin console). */
export function commissionPercent(rate: number): number {
  return Number((rate * 100).toFixed(2));
}

/** Progress toward the next rate tier, 0–100 (100 when already at the top tier). */
export function rateProgressPercent(info: RateInfo): number {
  return Math.min(100, info.nextTarget > 0 ? Math.round((info.volume / info.nextTarget) * 100) : 100);
}

/**
 * Row total shown for a payout: netPayout (post-WHT, includes all
 * adjustments) when available; the gross sum only for legacy records.
 */
export function historyNetTotal(item: EarningsHistoryItem): number {
  return item.netPayout !== undefined ? item.netPayout : item.direct + item.network + item.clawback;
}

/** Gross before WHT for a payout row. */
export function historyGross(item: EarningsHistoryItem): number {
  return item.direct + item.network + (item.badgeBonus ?? 0) + item.clawback;
}

/**
 * Adjustment lines to show: explicit adjustments when present, otherwise the
 * legacy single clawback line (only when non-zero).
 */
export function adjustmentLines(
  source: { adjustments?: EarningsAdjustment[]; clawback: number },
  fallbackReason: string,
): EarningsAdjustment[] {
  if (source.adjustments && source.adjustments.length > 0) {
    return source.adjustments.map((adj) => ({ amount: adj.amount, reason: adj.reason || fallbackReason }));
  }
  return source.clawback !== 0 ? [{ amount: source.clawback, reason: fallbackReason }] : [];
}

/** Whether the tax certificate (50 ทวิ) can be offered for this payout row. */
export function canOfferTawi50(item: EarningsHistoryItem): boolean {
  return Boolean(item.payoutDocument) && item.status === "approved" && (item.withholdingTax ?? 0) > 0;
}

/** Transfer statuses that are not final yet: keep syncing until they settle. */
export const PENDING_TRANSFER_STATUSES = ["PENDING_TRANSFER", "CREATED", "SENT_PENDING", "SENT"] as const;

export function isPendingTransfer(status: string | null | undefined): boolean {
  return (PENDING_TRANSFER_STATUSES as readonly string[]).includes(status ?? "");
}

/** "2026-10" → "ตุลาคม 2569". Anything else is returned unchanged. */
export function formatPeriodMonth(period: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period ?? "");
  if (!match) return period ?? "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return period ?? "";
  // Mid-month noon UTC is the same calendar month in Asia/Bangkok.
  return formatThaiMonthYear(new Date(Date.UTC(year, month - 1, 15, 12)));
}
