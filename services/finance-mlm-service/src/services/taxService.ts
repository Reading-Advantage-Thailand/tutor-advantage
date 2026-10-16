import { calculateWithholdingAtRate, WHT_RATE_PERCENT_BY_RESIDENCY } from "@tutor-advantage/shared-config";

/**
 * Withholding tax on a tutor payout. Residents: 3% (50 ทวิ); non-residents:
 * 15% (PND.54). Defaults to the resident rate.
 */
export function calculateWithholdingTax(
  grossPayoutMinor: bigint,
  ratePercent: number = WHT_RATE_PERCENT_BY_RESIDENCY.RESIDENT,
) {
  return calculateWithholdingAtRate(grossPayoutMinor, ratePercent);
}

export function buildReceiptNumber(paymentIntentId: string, issuedAt = new Date()) {
  return `RCT-${formatDatePart(issuedAt)}-${paymentIntentId.slice(0, 8)}`;
}

export function buildPayoutDocumentNumber(payoutLineId: string, issuedAt = new Date()) {
  return `50TAWI-${formatDatePart(issuedAt)}-${payoutLineId.slice(0, 8)}`;
}

function formatDatePart(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}
