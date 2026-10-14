"use client";

import { useMemo, useState } from "react";
import { AppBar, Screen } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { toLocalDateKey } from "@/lib/format";
import {
  addMonths,
  buildScheduleEvents,
  clampMonth,
  getNavigableMonthRange,
  groupEventsByDate,
  isSameDay,
  pickSelectedDateForMonth,
  startOfMonth,
  type ScheduleClass,
} from "@/lib/schedule";
import { DayAgenda } from "./DayAgenda";
import { MonthCalendar } from "./MonthCalendar";

const NO_EVENTS: never[] = [];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Calendar + agenda for the student's enrolled classes. */
export function ScheduleView({ classes }: { classes: ScheduleClass[] }) {
  // "Now" is fixed for the life of the screen (the occurrence window is built from it).
  const [today] = useState(() => new Date());
  const events = useMemo(() => buildScheduleEvents(classes, today), [classes, today]);
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const range = useMemo(() => getNavigableMonthRange(today, eventsByDate.keys()), [today, eventsByDate]);

  const [month, setMonth] = useState(() => startOfMonth(today));
  const [selected, setSelected] = useState(() => startOfDay(today));

  const goToMonth = (target: Date) => {
    const next = clampMonth(startOfMonth(target), range);
    if (next.getTime() === month.getTime()) return false;
    setMonth(next);
    return true;
  };
  const stepMonth = (delta: number) => {
    const next = clampMonth(addMonths(month, delta), range);
    if (goToMonth(next)) setSelected(pickSelectedDateForMonth(next, today));
  };
  const selectDay = (date: Date) => {
    setSelected(startOfDay(date));
    // Tapping a grey day of the previous/next month opens that month.
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) goToMonth(date);
  };
  const goToToday = () => {
    goToMonth(today);
    setSelected(startOfDay(today));
  };

  const canPrev = month.getTime() > range.first.getTime();
  const canNext = month.getTime() < range.last.getTime();
  const selectedEvents = eventsByDate.get(toLocalDateKey(selected)) ?? NO_EVENTS;
  const selectedIsToday = isSameDay(selected, today);

  return (
    <Screen>
      <AppBar
        title={t("schedule.title")}
        back
        fallbackHref="/dashboard"
        actions={
          <button
            type="button"
            onClick={goToToday}
            aria-label={t("schedule.goToToday")}
            className="pressable mr-1 inline-flex h-11 items-center rounded-full px-3 text-[15px] leading-[1.5] font-semibold text-brand-fg active:bg-press"
          >
            {t("schedule.today")}
          </button>
        }
      />

      <div className="flex flex-col gap-5 px-4 pt-2 pb-[calc(24px+var(--safe-bottom))]">
        <MonthCalendar
          month={month}
          selected={selected}
          today={today}
          eventsByDate={eventsByDate}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={() => stepMonth(-1)}
          onNext={() => stepMonth(1)}
          onSelect={selectDay}
        />
        <DayAgenda
          date={selected}
          isToday={selectedIsToday}
          events={selectedEvents}
          hasClasses={classes.length > 0}
        />
      </div>
    </Screen>
  );
}
