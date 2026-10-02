/**
 * "1,000.50" → 100050 satang. Accepts thousands separators and at most two
 * decimals; returns null for anything else (no parseFloat surprises: "1,000" ≠ 1).
 */
export function parseBahtToSatang(input: string): number | null {
  const cleaned = input.replace(/[,\s฿]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const satang = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(satang) && satang > 0 ? satang : null;
}
