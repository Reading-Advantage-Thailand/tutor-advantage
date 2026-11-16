import { formatSatang } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface AmountCardProps {
  label: string;
  /** Satang; null when unknown (shows a dash, never a made-up price). */
  amountSatang: number | null;
  /**
   * "hero": centred label + big number with no card of its own (it sits at
   * the top of the QR card) · "row": a card with the label left, amount right (card form).
   */
  layout?: "hero" | "row";
  className?: string;
}

/** The amount the student is about to pay: reading face 600, tabular (it is money, not a static hero number). */
export function AmountCard({ label, amountSatang, layout = "hero", className }: AmountCardProps) {
  const amount = amountSatang === null ? "–" : formatSatang(amountSatang);

  if (layout === "row") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-5 py-4 shadow-[var(--shadow-card)]",
          className,
        )}
      >
        <span className="text-[15px] leading-[1.6] text-fg-muted">{label}</span>
        <span className="text-2xl leading-[1.3] font-semibold text-brand-fg tabular-nums">{amount}</span>
      </div>
    );
  }

  return (
    <div className={cn("text-center", className)}>
      <p className="text-sm leading-[1.6] font-medium text-fg-muted">{label}</p>
      <p className="text-[34px] leading-[1.25] font-semibold text-fg tabular-nums">{amount}</p>
    </div>
  );
}
