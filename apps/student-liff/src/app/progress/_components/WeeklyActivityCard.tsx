import { Chip, Surface } from "@/components/mobile";
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
    <Surface as="section" padding="lg" aria-labelledby="progress-week-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="progress-week-title" className="t-title text-fg">
          {t("progress.thisWeek")}
        </h2>
        <Chip size="md" className="font-sans tabular-nums">
          {totalMinutes} {unit}
        </Chip>
      </div>
      <ul className="mt-4 grid grid-cols-7 gap-2">
        {bars.map((bar, index) => (
          <li key={`${bar.day}-${index}`} aria-label={`${bar.day} ${bar.minutes} ${unit}`} className="flex flex-col items-center gap-1">
            <span aria-hidden="true" className="h-[18px] text-xs leading-[1.5] font-semibold text-brand-fg tabular-nums">
              {bar.minutes > 0 ? bar.minutes : ""}
            </span>
            <span aria-hidden="true" className="relative block h-16 w-full overflow-hidden rounded-[10px] bg-fill-muted">
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 rounded-[10px]",
                  bar.active ? "bg-brand-vivid" : "bg-fg-subtle/25",
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
        <p className="mt-3 text-center text-sm leading-[1.6] text-fg-muted">{t("progress.noActivityYet")}</p>
      ) : null}
    </Surface>
  );
}
