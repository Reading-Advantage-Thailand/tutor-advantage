import { cn } from "@/lib/utils";

const monthShort = new Intl.DateTimeFormat("th-TH", { month: "short", timeZone: "UTC" });

/**
 * Calendar tile for a meeting row (decorative: the row title carries the full
 * date). Day number tabular over the short Thai month. Server-compatible.
 */
export function DateTile({ date, className }: { date: string; className?: string }) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-11 shrink-0 flex-col items-center justify-center rounded-(--radius-tile) bg-tile-purple text-icon-purple",
        className,
      )}
    >
      <span className="text-base leading-none font-semibold tabular">{parsed.getUTCDate()}</span>
      <span className="mt-0.5 text-xs leading-none font-medium">{monthShort.format(parsed)}</span>
    </span>
  );
}
