const WHT_RATE_PERCENT = 3n;

export function calculateWithholdingTax(grossPayoutMinor: bigint) {
  const withholdingTaxMinor = (grossPayoutMinor * WHT_RATE_PERCENT + 50n) / 100n;
  return {
    grossPayoutMinor,
    withholdingTaxMinor,
    netPayoutMinor: grossPayoutMinor - withholdingTaxMinor,
  };
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
