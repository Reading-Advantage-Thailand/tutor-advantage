"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Clock, Plus } from "lucide-react";
import { EmptyState, Grid, SegmentedControl, SplitLayout, StatCard, Surface } from "@/components/app";
import { Button, buttonVariants } from "@/components/ui/button";
import { RELATIVE_DAY_LABELS, formatNumber, formatThaiDate, formatThaiMonthYear } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CalendarSync } from "./components/CalendarSync";
import { DayAgenda } from "./components/EventList";
import type { CalendarExportInput } from "./lib/calendar-export";
import {
  addDays,
  addMonths,
  buildEvents,
  groupByDay,
  keyToDate,
  monthGrid,
  todayKey,
  totalMinutes,
  weekKeys,
  type DateKey,
  type ScheduleClass,
  type ScheduledEvent,
} from "./lib/schedule-events";

type View = "week" | "month";
const VIEW_STORAGE_KEY = "tutor-schedule-view";

const WEEKDAY_SHORT = [
  t("dashboardSchedule.weekdays.sun"),
  t("dashboardSchedule.weekdays.mon"),
  t("dashboardSchedule.weekdays.tue"),
  t("dashboardSchedule.weekdays.wed"),
  t("dashboardSchedule.weekdays.thu"),
  t("dashboardSchedule.weekdays.fri"),
  t("dashboardSchedule.weekdays.sat"),
];

/** "วันนี้ · ศ. 2 ต.ค." / "พรุ่งนี้ · ส. 3 ต.ค." / "จ. 5 ต.ค." */
function dayHeading(key: DateKey, today: DateKey): string {
  const date = formatThaiDate(keyToDate(key), "weekdayShort");
  if (key === today) return `${t("dashboardSchedule.today")} · ${date}`;
  if (key === addDays(today, 1)) return `${RELATIVE_DAY_LABELS.tomorrow} · ${date}`;
  return date;
}

function rangeTitle(view: View, anchor: DateKey): string {
  if (view === "month") return formatThaiMonthYear(keyToDate(anchor));
  const days = weekKeys(anchor);
  const first = keyToDate(days[0]);
  const last = keyToDate(days[6]);
  const sameMonth = days[0].slice(0, 7) === days[6].slice(0, 7);
  return sameMonth
    ? `${days[0].slice(8).replace(/^0/, "")}–${formatThaiDate(last, "long")}`
    : `${formatThaiDate(first, "short")} – ${formatThaiDate(last, "medium")}`;
}

export default function ScheduleClient({ initialClasses }: { initialClasses: ScheduleClass[] }) {
  const [today] = useState(() => todayKey());
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<DateKey>(today);

  // Remember the tutor's preferred view on this device.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "week" || saved === "month") setView(saved);
    } catch {
      // storage unavailable
    }
  }, []);
  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // storage unavailable
    }
  };

  const days = useMemo(() => (view === "week" ? weekKeys(anchor) : monthGrid(anchor).map((c) => c.key)), [view, anchor]);
  const events = useMemo(() => buildEvents(initialClasses, days[0], days[days.length - 1]), [initialClasses, days]);
  const byDay = useMemo(() => groupByDay(events), [events]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return buildEvents(initialClasses, today, addDays(today, 60)).find(
      (e) => e.dateKey > today || !e.start || (e.end ?? e.start) >= hhmm,
    );
  }, [initialClasses, today]);

  const exportable: CalendarExportInput[] = useMemo(
    () =>
      initialClasses
        .filter((c) => !c.isDemo)
        .map((c) => ({
          classId: c.id,
          title: c.name,
          schedule: c.nextSession || "",
          startsAt: c.startsAt ?? null,
          endsAt: c.endsAt ?? null,
          dateKey: today,
        })),
    [initialClasses, today],
  );

  const step = (direction: 1 | -1) =>
    setAnchor((current) => (view === "week" ? addDays(current, 7 * direction) : addMonths(current, direction)));

  if (initialClasses.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        tone="blue"
        title={t("dashboardSchedule.noClassesTitle")}
        description={t("dashboardSchedule.noClassesDescription")}
        action={
          <Link href="/dashboard/classes/new" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            {t("dashboardSchedule.createClass")}
          </Link>
        }
      />
    );
  }

  const isCurrentRange = days.includes(today) && (view === "week" || anchor.slice(0, 7) === today.slice(0, 7));
  const rangeEvents = view === "week" ? events : events.filter((e) => e.dateKey.slice(0, 7) === anchor.slice(0, 7));
  const hours = totalMinutes(rangeEvents) / 60;

  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step(-1)}
          aria-label={view === "week" ? t("dashboardSchedule.prevWeek") : t("dashboardSchedule.prevMonth")}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-fg tabular sm:flex-none sm:px-1 md:text-lg" aria-live="polite">
          {rangeTitle(view, anchor)}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step(1)}
          aria-label={view === "week" ? t("dashboardSchedule.nextWeek") : t("dashboardSchedule.nextMonth")}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button variant="outline" size="sm" className="ml-1" disabled={isCurrentRange && anchor === today} onClick={() => setAnchor(today)}>
          {t("dashboardSchedule.goToday")}
        </Button>
      </div>
      <div className="shrink-0 max-sm:order-first sm:w-56">
        <SegmentedControl<View>
          aria-label={t("dashboardSchedule.viewLabel")}
          items={[
            { value: "week", label: t("dashboardSchedule.viewWeek"), icon: CalendarRange },
            { value: "month", label: t("dashboardSchedule.viewMonth"), icon: CalendarDays },
          ]}
          value={view}
          onValueChange={changeView}
          fullWidth
        />
      </div>
    </div>
  );

  const stats = (
    <Grid cols={2} className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-1">
      <StatCard
        label={t("dashboardSchedule.statSessions")}
        value={`${formatNumber(rangeEvents.length)} ${t("dashboardSchedule.sessionsUnit")}`}
        icon={CalendarClock}
        tone="blue"
      />
      <StatCard
        label={t("dashboardSchedule.statHours")}
        value={`${formatNumber(Math.round(hours * 10) / 10)} ${t("dashboardSchedule.hoursUnit")}`}
        icon={Clock}
        tone="blue"
      />
    </Grid>
  );

  const nextCard = upcoming ? (
    <Surface padding="md" href={`/dashboard/classes/${upcoming.classId}`}>
      <p className="text-[0.8125rem] text-fg-muted">{t("dashboardSchedule.statNext")}</p>
      <p className="mt-1 text-base font-semibold text-fg">{dayHeading(upcoming.dateKey, today)}</p>
      <p className="text-sm text-fg">{upcoming.timeLabel}</p>
      <p className="mt-1 truncate text-[0.8125rem] text-fg-muted">{upcoming.title}</p>
    </Surface>
  ) : null;

  return (
    <SplitLayout
      main={
        <>
          {toolbar}
          {view === "week" ? (
            <WeekView days={days} byDay={byDay} today={today} anchor={anchor} onSelect={setAnchor} />
          ) : (
            <MonthView anchor={anchor} byDay={byDay} today={today} onSelect={setAnchor} />
          )}
        </>
      }
      side={
        <>
          {view === "month" ? (
            <section aria-labelledby="selected-day-heading" className="flex flex-col gap-2">
              <h3 id="selected-day-heading" className="px-1 text-sm font-semibold text-fg-muted">
                {dayHeading(anchor, today)}
              </h3>
              <DayAgenda events={byDay.get(anchor) ?? []} label={dayHeading(anchor, today)} />
            </section>
          ) : null}
          {stats}
          {nextCard}
          <CalendarSync classes={exportable} />
        </>
      }
    />
  );
}

/* ─── Week: day strip + agenda for all 7 days ───────────────────────────── */

function WeekView({
  days,
  byDay,
  today,
  anchor,
  onSelect,
}: {
  days: DateKey[];
  byDay: Map<DateKey, ScheduledEvent[]>;
  today: DateKey;
  anchor: DateKey;
  onSelect: (key: DateKey) => void;
}) {
  const total = days.reduce((sum, key) => sum + (byDay.get(key)?.length ?? 0), 0);
  const select = (key: DateKey) => {
    onSelect(key);
    document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <>
      <div role="group" aria-label={t("dashboardSchedule.weekStripLabel")} className="grid grid-cols-7 gap-1 rounded-xl border border-hairline bg-surface p-1.5 shadow-card">
        {days.map((key) => {
          const count = byDay.get(key)?.length ?? 0;
          const isToday = key === today;
          const selected = key === anchor;
          return (
            <button
              key={key}
              type="button"
              onClick={() => select(key)}
              aria-pressed={selected}
              aria-label={`${formatThaiDate(keyToDate(key), "full")} · ${count > 0 ? t("dashboardSchedule.sessionsOnDay").replace("{count}", String(count)) : t("dashboardSchedule.noClassesDay")}`}
              className={cn(
                "pressable flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-fg hover:bg-surface-muted",
                selected && "bg-brand-solid text-on-brand hover:bg-brand-solid",
              )}
            >
              <span className={cn("text-xs", selected ? "text-on-brand" : isToday ? "font-semibold text-brand-fg" : "text-fg-muted")}>
                {WEEKDAY_SHORT[days.indexOf(key)]}
              </span>
              <span className={cn("text-base font-semibold tabular", !selected && isToday && "text-brand-fg")}>
                {Number(key.slice(8))}
              </span>
              <span aria-hidden="true" className="flex h-1.5 items-center gap-0.5">
                {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                  <span key={i} className={cn("size-1.5 rounded-full", selected ? "bg-on-brand" : "bg-brand-vivid")} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {total === 0 ? (
        <EmptyState
          icon={CalendarRange}
          tone="blue"
          title={t("dashboardSchedule.weekEmptyTitle")}
          description={t("dashboardSchedule.weekEmptyDescription")}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {days.map((key) => {
            const dayEvents = byDay.get(key) ?? [];
            const heading = dayHeading(key, today);
            const past = key < today;
            return (
              <section key={key} id={`day-${key}`} aria-labelledby={`day-${key}-h`} className="flex scroll-mt-24 flex-col gap-2">
                <h3
                  id={`day-${key}-h`}
                  className={cn(
                    "flex items-center gap-2 px-1 text-sm font-semibold",
                    key === today ? "text-brand-fg" : past ? "text-fg-subtle" : "text-fg-muted",
                  )}
                >
                  {heading}
                  <span className="font-normal text-fg-subtle">
                    ·{" "}
                    {dayEvents.length > 0
                      ? t("dashboardSchedule.sessionsOnDay").replace("{count}", String(dayEvents.length))
                      : t("dashboardSchedule.noClassesDay")}
                  </span>
                </h3>
                {dayEvents.length > 0 ? (
                  <DayAgenda events={dayEvents} label={heading} className={cn(past && "opacity-70")} />
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ─── Month: grid (pills on md+, dots on phones) ────────────────────────── */

function MonthView({
  anchor,
  byDay,
  today,
  onSelect,
}: {
  anchor: DateKey;
  byDay: Map<DateKey, ScheduledEvent[]>;
  today: DateKey;
  onSelect: (key: DateKey) => void;
}) {
  const cells = monthGrid(anchor);
  return (
    <div
      role="grid"
      aria-label={t("dashboardSchedule.monthGridLabel").replace("{month}", formatThaiMonthYear(keyToDate(anchor)))}
      className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-card"
    >
      <div role="row" className="grid grid-cols-7 border-b border-hairline bg-surface-muted">
        {WEEKDAY_SHORT.map((label, index) => (
          <div
            key={label}
            role="columnheader"
            className={cn("py-2 text-center text-xs font-medium", index === 0 || index === 6 ? "text-fg-subtle" : "text-fg-muted")}
          >
            {label}
          </div>
        ))}
      </div>
      {Array.from({ length: 6 }, (_, row) => (
        <div key={row} role="row" className="grid grid-cols-7 border-hairline [&:not(:last-child)]:border-b">
          {cells.slice(row * 7, row * 7 + 7).map(({ key, inMonth }) => {
            const dayEvents = byDay.get(key) ?? [];
            const selected = key === anchor;
            const isToday = key === today;
            return (
              <div key={key} role="gridcell" aria-selected={selected} className="border-hairline [&:not(:last-child)]:border-r">
                <button
                  type="button"
                  onClick={() => onSelect(key)}
                  aria-label={`${formatThaiDate(keyToDate(key), "full")} · ${dayEvents.length > 0 ? t("dashboardSchedule.sessionsOnDay").replace("{count}", String(dayEvents.length)) : t("dashboardSchedule.noClassesDay")}`}
                  className={cn(
                    "flex h-14 w-full flex-col items-center gap-1 px-1 pt-1.5 text-left hover:bg-surface-muted focus-visible:relative focus-visible:z-10 md:h-28 md:items-stretch md:px-1.5",
                    selected && "bg-brand-soft hover:bg-brand-soft",
                    !inMonth && "bg-surface-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm tabular md:size-6 md:text-[0.8125rem]",
                      !inMonth && "text-fg-subtle",
                      inMonth && "text-fg",
                      isToday && "bg-brand-solid font-semibold text-on-brand",
                      selected && !isToday && "font-semibold text-brand-fg",
                    )}
                  >
                    {Number(key.slice(8))}
                  </span>
                  {dayEvents.length > 0 ? (
                    <>
                      <span aria-hidden="true" className="flex gap-0.5 md:hidden">
                        {Array.from({ length: Math.min(dayEvents.length, 3) }, (_, i) => (
                          <span key={i} className="size-1.5 rounded-full bg-brand-vivid" />
                        ))}
                      </span>
                      <span aria-hidden="true" className="hidden min-w-0 flex-col gap-0.5 md:flex">
                        {dayEvents.slice(0, 2).map((event) => (
                          <span
                            key={event.id}
                            className={cn(
                              "truncate rounded-md px-1.5 py-0.5 text-xs leading-tight",
                              inMonth ? "bg-brand-soft text-brand-fg" : "bg-fill-muted text-fg-muted",
                            )}
                          >
                            {event.start ? `${event.start} ` : ""}
                            {event.title}
                          </span>
                        ))}
                        {dayEvents.length > 2 ? (
                          <span className="px-1.5 text-xs text-fg-muted">
                            +{dayEvents.length - 2} {t("dashboardSchedule.moreClassesSuffix")}
                          </span>
                        ) : null}
                      </span>
                    </>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
