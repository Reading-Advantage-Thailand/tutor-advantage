import type { CSSProperties } from "react";
import { levelTone, Section, tileToneClass } from "@/components/app";
import { formatThaiDate } from "@/lib/format";
import { t, type I18nKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { keyToDate } from "../schedule/lib/schedule-events";
import { gridPosition, type HomeSchedule, type HomeSession } from "./home-schedule";
import { LoadErrorLine } from "./LoadErrorLine";
import { EmptyLine } from "./TodaySessions";

const WEEKDAY_KEYS: I18nKey[] = [
  "dashboardSchedule.weekdays.sun",
  "dashboardSchedule.weekdays.mon",
  "dashboardSchedule.weekdays.tue",
  "dashboardSchedule.weekdays.wed",
  "dashboardSchedule.weekdays.thu",
  "dashboardSchedule.weekdays.fri",
  "dashboardSchedule.weekdays.sat",
];

/** "9 – 15 พ.ย." (same month) or "30 พ.ย. – 6 ธ.ค.". */
export function weekRangeLabel(firstKey: string, lastKey: string): string {
  const last = formatThaiDate(keyToDate(lastKey), "short");
  if (firstKey.slice(0, 7) === lastKey.slice(0, 7)) return `${Number(firstKey.slice(8, 10))} – ${last}`;
  return `${formatThaiDate(keyToDate(firstKey), "short")} – ${last}`;
}

function timeRange(session: HomeSession): string {
  return session.end ? `${session.start}–${session.end}` : session.start;
}

/**
 * "ตารางสอนสัปดาห์นี้" (patterns.md T1 desktop): 7 day rows (Monday first) ×
 * the hours 09–20 (wider when a session falls outside), class blocks in
 * their CEFR tile tone with a 3px leading edge, today's label in a
 * --brand-soft pill. A read-only overview (the rows above and ตารางสอน are
 * the tap targets), so blocks are text with the time for screen readers.
 * Desktop only (≥ 1024). When the class list failed: the cause only (the
 * today block right above carries the retry). Server component.
 */
export function WeekGrid({
  schedule,
  unavailable,
  className,
}: {
  schedule: HomeSchedule;
  /** `GET /v1/classes` failed, so the week is unknown (not empty). */
  unavailable?: boolean;
  className?: string;
}) {
  const { week, hourFrom, hourTo } = schedule;
  const hours = Array.from({ length: hourTo - hourFrom }, (_, index) => hourFrom + index);
  const columns: CSSProperties = { gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` };
  const isEmpty = week.every((day) => day.sessions.length === 0);
  return (
    <Section
      id="home-week"
      title={t("dashboardHome.weekSchedule")}
      action={<span className="type-body-s text-fg-muted tabular">{weekRangeLabel(week[0].dateKey, week[6].dateKey)}</span>}
      className={className}
    >
      {unavailable ? (
        <LoadErrorLine text={t("dashboardHome.scheduleUnavailable")} retry={false} />
      ) : isEmpty ? (
        <EmptyLine text={t("dashboardSchedule.weekEmptyTitle")} />
      ) : (
        <div className="ds-card px-4 pt-3 pb-4">
          <div aria-hidden="true" className="grid grid-cols-[44px_minmax(0,1fr)] pb-1">
            <span />
            <div className="grid type-caption text-fg-subtle tabular" style={columns}>
              {hours.map((hour) => (
                <span key={hour}>{String(hour).padStart(2, "0")}</span>
              ))}
            </div>
          </div>
          <ol className="flex flex-col">
            {week.map((day) => (
              <li
                key={day.dateKey}
                aria-current={day.isToday ? "date" : undefined}
                className="grid h-9 grid-cols-[44px_minmax(0,1fr)] items-center border-t border-dashed border-hairline first:border-t-0"
              >
                <span
                  className={cn(
                    "text-[0.8125rem] leading-none",
                    day.isToday
                      ? "inline-grid h-6 w-8 place-items-center rounded-full bg-brand-soft font-semibold text-brand-soft-fg"
                      : "font-medium text-fg-muted",
                  )}
                >
                  <span aria-hidden="true">{t(WEEKDAY_KEYS[day.weekday])}.</span>
                  <span className="sr-only">{formatThaiDate(keyToDate(day.dateKey), "full")}</span>
                </span>
                <div className="relative h-6">
                  {day.sessions.length === 0 ? <span className="sr-only">{t("dashboardSchedule.noClassesDay")}</span> : null}
                  {day.sessions.map((session) => {
                    const { left, width } = gridPosition(session, hourFrom, hourTo);
                    return (
                      <span
                        key={session.id}
                        title={`${session.title} · ${timeRange(session)}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        className={cn(
                          "absolute top-0 flex h-6 min-w-6 items-center overflow-hidden rounded-md pr-1.5 pl-2 text-xs leading-none font-semibold whitespace-nowrap shadow-[inset_3px_0_0_currentColor]",
                          tileToneClass[levelTone(session.level)],
                        )}
                      >
                        <span className="truncate">{session.title}</span>
                        <span className="sr-only"> {timeRange(session)}</span>
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Section>
  );
}
