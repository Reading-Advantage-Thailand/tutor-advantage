import { formatSatang } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface AmountCardProps {
  label: string;
  /** Satang; null when unknown (shows a dash, never a made-up price). */
  amountSatang: number | null;
  /** "hero": centred big number (QR screen) · "row": label left, amount right (card form). */
  layout?: "hero" | "row";
  className?: string;
}

/** The amount the student is about to pay. */
export function AmountCard({ label, amountSatang, layout = "hero", className }: AmountCardProps) {
  const amount = amountSatang === null ? "–" : formatSatang(amountSatang);
  const base = "rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)]";

  if (layout === "row") {
    return (
      <div className={cn(base, "flex items-center justify-between gap-3 px-4 py-3.5", className)}>
        <span className="text-[15px] leading-[1.5] text-fg-muted">{label}</span>
        <span className="text-xl leading-[1.4] font-extrabold text-brand-fg tabular-nums">{amount}</span>
      </div>
    );
  }

  return (
    <div className={cn(base, "px-5 py-4 text-center", className)}>
      <p className="text-[13px] leading-[1.5] text-fg-muted">{label}</p>
      <p className="mt-0.5 text-[32px] leading-[1.25] font-extrabold text-brand-fg tabular-nums">{amount}</p>
    </div>
  );
}
