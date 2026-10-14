import { formatMinor, formatTHB, type MoneyFormatOptions } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Money display (tabular digits, red for negatives). Pass `satang` (minor
 * units, number or numeric string as the API returns) OR `baht`.
 * Server-compatible.
 */
export function Money({
  satang,
  baht,
  className,
  muted,
  ...options
}: MoneyFormatOptions & { satang?: number | string | null; baht?: number | null; className?: string; muted?: boolean }) {
  const value = satang !== undefined ? (typeof satang === "string" ? Number(satang) / 100 : satang === null ? null : satang / 100) : baht;
  const text = satang !== undefined ? formatMinor(satang, options) : formatTHB(baht, options);
  return (
    <span className={cn("tabular whitespace-nowrap", typeof value === "number" && value < 0 && "text-danger-fg", muted && "text-fg-muted", className)}>
      {text}
    </span>
  );
}
