/**
 * Small display helpers shared by the G1 pages (home, performance, network).
 * Tested in text.test.ts.
 */

/** Commission rate ratio → "43%" / "42.5%" (at most 2 decimals, no float noise). */
export function formatRatePercent(rate: number | null | undefined): string {
  const value = typeof rate === "number" && Number.isFinite(rate) ? rate : 0;
  const pct = Number((value * 100).toFixed(2));
  return `${pct.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

/** Replace `{name}` placeholders in a locale string. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
