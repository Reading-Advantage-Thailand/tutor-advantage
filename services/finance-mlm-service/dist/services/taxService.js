"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateVatInclusive = calculateVatInclusive;
exports.calculateWithholdingTax = calculateWithholdingTax;
exports.buildReceiptNumber = buildReceiptNumber;
exports.buildPayoutDocumentNumber = buildPayoutDocumentNumber;
const WHT_RATE_PERCENT = 3n;
function calculateVatInclusive(grossAmountMinor) {
    const vatAmountMinor = (grossAmountMinor * 7n + 53n) / 107n;
    return {
        grossAmountMinor,
        vatAmountMinor,
        netAmountMinor: grossAmountMinor - vatAmountMinor,
    };
}
function calculateWithholdingTax(grossPayoutMinor) {
    const withholdingTaxMinor = (grossPayoutMinor * WHT_RATE_PERCENT + 50n) / 100n;
    return {
        grossPayoutMinor,
        withholdingTaxMinor,
        netPayoutMinor: grossPayoutMinor - withholdingTaxMinor,
    };
}
function buildReceiptNumber(paymentIntentId, issuedAt = new Date()) {
    return `RCT-${formatDatePart(issuedAt)}-${paymentIntentId.slice(0, 8)}`;
}
function buildPayoutDocumentNumber(payoutLineId, issuedAt = new Date()) {
    return `50TAWI-${formatDatePart(issuedAt)}-${payoutLineId.slice(0, 8)}`;
}
function formatDatePart(date) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
}
