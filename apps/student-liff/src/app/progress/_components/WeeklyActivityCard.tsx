import { Chip } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getWeekChart, type WeeklyActivity } from "./progressModel";

/**
 * Minutes studied per day this week. Each day is a list item with a spoken
 * label ("อ. 25 นาที") and the minutes are printed above active bars, so the
 * chart works without hover tooltips. Server-compatible.
 */
export function WeeklyActivityCard({ weeklyActivity }: { weeklyActivity: WeeklyActivity[] }) {
  const { bars, totalMinutes } = getWeekChart(weeklyActivity);
  const unit = t("progress.minuteUnit");

  return (
    <section
      aria-labelledby="progress-week-title"
      className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="progress-week-title" className="text-[17px] leading-[1.5] font-bold text-fg">
          {t("progress.thisWeek")}
        </h2>
        <Chip size="md" className="tabular-nums">
          {totalMinutes} {unit}
        </Chip>
      </div>
      <ul className="mt-3 grid grid-cols-7 gap-2">
        {bars.map((bar, index) => (
          <li key={`${bar.day}-${index}`} aria-label={`${bar.day} ${bar.minutes} ${unit}`} className="flex flex-col items-center gap-1">
            <span aria-hidden="true" className="h-[18px] text-xs leading-[1.5] font-semibold text-brand-fg tabular-nums">
              {bar.minutes > 0 ? bar.minutes : ""}
            </span>
            <span aria-hidden="true" className="relative block h-16 w-full overflow-hidden rounded-lg bg-fill-muted">
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 rounded-lg",
                  bar.active ? "bg-brand-vivid" : "bg-[var(--neutral-300)]",
                )}
                style={{ height: `${bar.heightPct}%` }}
              />
            </span>
            <span aria-hidden="true" className="text-xs leading-[1.5] font-medium text-fg-muted">
              {bar.day}
            </span>
          </li>
        ))}
      </ul>
      {totalMinutes === 0 ? (
        <p className="mt-3 text-center text-[13px] leading-[1.5] text-fg-muted">{t("progress.noActivityYet")}</p>
      ) : null}
    </section>
  );
}
