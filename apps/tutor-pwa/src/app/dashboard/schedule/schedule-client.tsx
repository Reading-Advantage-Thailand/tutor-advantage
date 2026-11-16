"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Count, EmptyState, SegmentedControl, SplitLayout, StatStrip, Surface, levelIconClass, levelTone, tileToneClass } from "@/components/app";
import { Button, buttonVariants } from "@/components/ui/button";
import { RELATIVE_DAY_LABELS, formatNumber, formatThaiDate, formatThaiMonthYear } from "@/lib/format";
import { t } from "@/lib/i18n";
import { scrollBehavior } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { CalendarSync } from "./components/CalendarSync";
import { DayAgenda, eventLevel } from "./components/EventList";
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

/** `compact`: short month for the week title on phones ("8–14 พ.ย. 2569"); the long month does not fit beside the nav buttons. */
function rangeTitle(view: View, anchor: DateKey, compact = false): string {
  if (view === "month") return formatThaiMonthYear(keyToDate(anchor));
  const days = weekKeys(anchor);
  const first = keyToDate(days[0]);
  const last = keyToDate(days[6]);
  const sameMonth = days[0].slice(0, 7) === days[6].slice(0, 7);
  if (sameMonth) return `${days[0].slice(8).replace(/^0/, "")}–${formatThaiDate(last, compact ? "medium" : "long")}`;
  const from = formatThaiDate(first, "short");
  const to = formatThaiDate(last, "medium");
  // A two-month range can wrap on a narrow phone: non-breaking spaces keep each date whole, so the only break is after the dash.
  return compact ? `${from.replace(/ /g, " ")} – ${to.replace(/ /g, " ")}` : `${from} – ${to}`;
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
        mascot
        icon={CalendarDays}
        tone="purple"
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
    // sm+: one row while it fits; where the main column is narrow (two-column
    // layout from 1024) the view switch wraps under the date nav instead of
    // sliding beneath it.
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step(-1)}
          aria-label={view === "week" ? t("dashboardSchedule.prevWeek") : t("dashboardSchedule.prevMonth")}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        {/* Phones: short month, and a title that still does not fit wraps (1.6 line height) instead of cutting off. */}
        <h2
          className="min-w-0 flex-1 text-center type-section text-fg tabular max-sm:leading-[1.6] max-sm:text-balance-th sm:flex-none sm:px-1 sm:whitespace-nowrap"
          aria-live="polite"
        >
          <span className="sm:hidden">{rangeTitle(view, anchor, true)}</span>
          <span className="max-sm:hidden">{rangeTitle(view, anchor)}</span>
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step(1)}
          aria-label={view === "week" ? t("dashboardSchedule.nextWeek") : t("dashboardSchedule.nextMonth")}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        {/* Below 360px the button gives 16px back to the title, so a one-month range stays on one line. */}
        <Button
          variant="outline"
          className="ml-1 max-[360px]:ml-0 max-[360px]:px-2.5"
          disabled={isCurrentRange && anchor === today}
          onClick={() => setAnchor(today)}
        >
          {t("dashboardSchedule.goToday")}
        </Button>
      </div>
      <div className="shrink-0 max-sm:order-first sm:ml-auto sm:w-56">
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
    <StatStrip
      aria-label={rangeTitle(view, anchor)}
      items={[
        {
          label: t("dashboardSchedule.statSessions"),
          value: `${formatNumber(rangeEvents.length)} ${t("dashboardSchedule.sessionsUnit")}`,
        },
        {
          label: t("dashboardSchedule.statHours"),
          value: `${formatNumber(Math.round(hours * 10) / 10)} ${t("dashboardSchedule.hoursUnit")}`,
        },
      ]}
    />
  );

  const nextCard = upcoming ? (
    <Surface padding="md" href={`/dashboard/classes/${upcoming.classId}`} className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2">
        <span className="type-label text-fg-muted">{t("dashboardSchedule.statNext")}</span>
        <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-fg-subtle" />
      </span>
      <span className="type-card text-fg">{dayHeading(upcoming.dateKey, today)}</span>
      {upcoming.start ? (
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="type-hero-time text-fg">{upcoming.start}</span>
          {upcoming.end ? <span className="type-body-s text-fg-muted tabular">– {upcoming.end}</span> : null}
        </span>
      ) : (
        <span className="type-body-s text-fg-muted">{upcoming.timeLabel}</span>
      )}
      <span className="mt-1 flex min-w-0 items-center gap-2 border-t border-hairline pt-2.5 type-body-s text-fg">
        <span aria-hidden="true" className={cn("ds-level-dot shrink-0", levelIconClass[levelTone(eventLevel(upcoming.book))])} />
        <span className="truncate font-medium" title={upcoming.title}>
          {upcoming.title}
        </span>
      </span>
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
              <h3 id="selected-day-heading" className="flex min-h-8 items-center gap-2 px-1 type-card text-fg">
                {dayHeading(anchor, today)}
                {(byDay.get(anchor)?.length ?? 0) > 0 ? <Count value={byDay.get(anchor)?.length ?? 0} /> : null}
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

/**
 * Scrolls the day strip (never the page) so a day cut off at its edge comes
 * fully into view. Always to an end: the ends are the strip's snap points, and
 * a shorter move would be snapped back.
 */
function revealDay(strip: HTMLElement, day: Element, behavior: ScrollBehavior) {
  const view = strip.getBoundingClientRect();
  const box = day.getBoundingClientRect();
  if (box.left < view.left) strip.scrollTo({ left: 0, behavior });
  else if (box.right > view.right) strip.scrollTo({ left: strip.scrollWidth, behavior });
}

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
  const selectedIndex = days.indexOf(anchor);
  const stripRef = useRef<HTMLDivElement>(null);
  const revealed = useRef(false);
  const [more, setMore] = useState({ start: false, end: false });

  /*
   * Day buttons are never narrower than a 44px touch target. Seven of them fit
   * the card from 360px up (the gap gives way first). Below 360px the card
   * runs edge to edge (no side rim, no corners) and the gap closes, so all
   * seven days still show on a 320px phone: 7 × 44 + 2 × 6 = 320, and the 6px
   * padding keeps room for the focus ring. Only where even that is too narrow
   * does the strip scroll sideways, with an edge shadow on the side that has a
   * day out of view.
   */
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const update = () => {
      const start = strip.scrollLeft > 1;
      const end = strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 1;
      setMore((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    strip.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(strip);
    return () => {
      strip.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, []);

  // The selected day stays in view: at once on arrival, animated after that.
  useEffect(() => {
    const strip = stripRef.current;
    const day = strip?.children[selectedIndex];
    if (strip && day) revealDay(strip, day, revealed.current ? scrollBehavior() : "auto");
    revealed.current = true;
  }, [anchor, selectedIndex]);

  const select = (key: DateKey) => {
    onSelect(key);
    document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  };
  const edgeClass = "pointer-events-none absolute inset-y-0 w-4 transition-opacity duration-(--duration-fast)";
  return (
    <>
      <div className="ds-card relative overflow-hidden max-[360px]:mx-[calc(var(--gutter)*-1)] max-[360px]:rounded-none max-[360px]:border-x-0">
        <div
          ref={stripRef}
          role="group"
          aria-label={t("dashboardSchedule.weekStripLabel")}
          // Keyboard focus on a cut-off day brings it into view (a tap is handled on select).
          onFocus={(event) => {
            if (event.target.matches(":focus-visible")) revealDay(event.currentTarget, event.target, scrollBehavior());
          }}
          className="scrollbar-hide grid snap-x snap-proximity scroll-px-1.5 grid-cols-[repeat(7,minmax(2.75rem,1fr))] gap-x-[clamp(0px,(100%_-_19.25rem)/6,0.25rem)] overflow-x-auto overscroll-x-contain p-1.5 sm:gap-x-1.5 sm:p-2"
        >
          {days.map((key) => {
            const dayEvents = byDay.get(key) ?? [];
            const count = dayEvents.length;
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
                  "pressable flex min-h-[68px] snap-start flex-col items-center justify-center gap-0.5 rounded-(--radius-ctl) py-1.5 text-fg transition-colors duration-(--duration-fast) hover:bg-row-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring",
                  selected && "bg-brand-solid text-on-brand hover:bg-brand-solid",
                  !selected && isToday && "shadow-[inset_0_0_0_2px_var(--brand-fg)]",
                )}
              >
                <span className={cn("text-xs", selected ? "text-on-brand" : isToday ? "font-semibold text-brand-fg" : "text-fg-muted")}>
                  {WEEKDAY_SHORT[days.indexOf(key)]}
                </span>
                <span className={cn("text-lg leading-tight font-semibold tabular", !selected && isToday && "text-brand-fg")}>
                  {Number(key.slice(8))}
                </span>
                <span aria-hidden="true" className="flex h-1.5 items-center gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={cn(
                        "size-1.5 rounded-full",
                        selected ? "bg-on-brand" : cn("bg-current", levelIconClass[levelTone(eventLevel(event.book))]),
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <span
          aria-hidden="true"
          className={cn(edgeClass, "left-0 shadow-[inset_14px_0_12px_-12px_var(--table-edge-shadow)]", more.start ? "opacity-100" : "opacity-0")}
        />
        <span
          aria-hidden="true"
          className={cn(edgeClass, "right-0 shadow-[inset_-14px_0_12px_-12px_var(--table-edge-shadow)]", more.end ? "opacity-100" : "opacity-0")}
        />
      </div>

      {total === 0 ? (
        <EmptyState
          icon={CalendarRange}
          tone="purple"
          title={t("dashboardSchedule.weekEmptyTitle")}
          description={t("dashboardSchedule.weekEmptyDescription")}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {days.map((key) => {
            const dayEvents = byDay.get(key) ?? [];
            const heading = dayHeading(key, today);
            const past = key < today;
            return (
              <section key={key} id={`day-${key}`} aria-labelledby={`day-${key}-h`} className="flex scroll-mt-24 flex-col gap-2">
                <h3
                  id={`day-${key}-h`}
                  className={cn(
                    "flex flex-wrap items-center gap-x-2 px-1 type-card",
                    key === today ? "text-brand-fg" : past ? "text-fg-muted" : "text-fg",
                  )}
                >
                  {key === today ? <span aria-hidden="true" className="size-2 rounded-full bg-brand-solid" /> : null}
                  {heading}
                  <span className="text-sm font-normal text-fg-muted">
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
  const gridRef = useRef<HTMLDivElement>(null);
  const focusKeyRef = useRef<DateKey | null>(null);

  // After an arrow key moves the selection (possibly into another month), focus the new day.
  useEffect(() => {
    const key = focusKeyRef.current;
    if (!key) return;
    focusKeyRef.current = null;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${key}"]`)?.focus();
  }, [anchor]);

  // Grid keyboard model: one Tab stop (the selected day); arrows move by a day or a week, Home/End to the row ends.
  const onDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: DateKey, column: number) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -column, End: 6 - column };
    const delta = moves[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    if (delta === 0) return;
    const next = addDays(key, delta);
    focusKeyRef.current = next;
    onSelect(next);
  };

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={t("dashboardSchedule.monthGridLabel").replace("{month}", formatThaiMonthYear(keyToDate(anchor)))}
      className="ds-card overflow-hidden"
    >
      <div role="row" className="grid grid-cols-7 border-b border-hairline bg-surface-muted">
        {WEEKDAY_SHORT.map((label, index) => (
          <div
            key={label}
            role="columnheader"
            className={cn("py-2.5 text-center text-xs font-semibold", index === 0 || index === 6 ? "text-fg-subtle" : "text-fg-muted")}
          >
            {label}
          </div>
        ))}
      </div>
      {Array.from({ length: 6 }, (_, row) => (
        <div key={row} role="row" className="grid grid-cols-7 border-hairline [&:not(:last-child)]:border-b">
          {cells.slice(row * 7, row * 7 + 7).map(({ key, inMonth }, column) => {
            const dayEvents = byDay.get(key) ?? [];
            const selected = key === anchor;
            const isToday = key === today;
            return (
              <div key={key} role="gridcell" aria-selected={selected} className="border-hairline [&:not(:last-child)]:border-r">
                <button
                  type="button"
                  data-day={key}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onSelect(key)}
                  onKeyDown={(event) => onDayKeyDown(event, key, column)}
                  aria-label={`${formatThaiDate(keyToDate(key), "full")} · ${dayEvents.length > 0 ? t("dashboardSchedule.sessionsOnDay").replace("{count}", String(dayEvents.length)) : t("dashboardSchedule.noClassesDay")}`}
                  className={cn(
                    "flex h-14 w-full flex-col items-center gap-1 px-1 pt-1.5 text-left transition-colors duration-(--duration-fast) hover:bg-row-hover focus-visible:relative focus-visible:z-10 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-solid focus-visible:outline-focus-ring md:h-28 md:items-stretch md:px-1.5",
                    selected && "bg-brand-soft/60 hover:bg-brand-soft",
                    !inMonth && "bg-surface-muted",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm tabular md:text-[0.8125rem]",
                      !inMonth && "text-fg-subtle",
                      inMonth && "text-fg",
                      isToday && !selected && "font-semibold text-brand-fg shadow-[inset_0_0_0_2px_var(--brand-fg)]",
                      selected && "bg-brand-solid font-semibold text-on-brand",
                    )}
                  >
                    {Number(key.slice(8))}
                  </span>
                  {dayEvents.length > 0 ? (
                    <>
                      <span aria-hidden="true" className="flex gap-0.5 md:hidden">
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            className={cn("size-1.5 rounded-full bg-current", levelIconClass[levelTone(eventLevel(event.book))])}
                          />
                        ))}
                      </span>
                      <span aria-hidden="true" className="hidden min-w-0 flex-col gap-0.5 md:flex">
                        {dayEvents.slice(0, 2).map((event) => (
                          <span
                            key={event.id}
                            className={cn(
                              "truncate rounded-[6px] border-l-[3px] py-0.5 pr-1.5 pl-1 text-xs leading-tight font-medium",
                              inMonth ? tileToneClass[levelTone(eventLevel(event.book))] : "bg-fill-muted text-fg-muted",
                              "border-current",
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
