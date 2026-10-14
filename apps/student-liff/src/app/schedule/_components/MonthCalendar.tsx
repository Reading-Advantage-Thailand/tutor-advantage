"use client";

import { useMemo, useRef, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton, Surface } from "@/components/mobile";
import { formatThaiDate, formatThaiMonthYear } from "@/lib/format";
import { studentScheduleCopy, t } from "@/lib/i18n";
import { getMonthGrid, getSwipeMonthDelta, isSameDay, type ScheduledEvent } from "@/lib/schedule";
import { cn } from "@/lib/utils";

interface MonthCalendarProps {
  /** 1st of the month on screen. */
  month: Date;
  selected: Date;
  today: Date;
  eventsByDate: ReadonlyMap<string, ScheduledEvent[]>;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (date: Date) => void;
}

/**
 * Month grid with 44px day cells (dot = has class, ring = today, filled =
 * selected). Swipe left/right or use the arrows to change month.
 */
export function MonthCalendar({
  month,
  selected,
  today,
  eventsByDate,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onSelect,
}: MonthCalendarProps) {
  const cells = useMemo(() => getMonthGrid(month), [month]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch) return;
    const delta = getSwipeMonthDelta(touch.clientX - start.x, touch.clientY - start.y);
    if (delta === 1 && canNext) onNext();
    else if (delta === -1 && canPrev) onPrev();
  };

  return (
    <Surface as="section" padding="none" aria-label={t("schedule.calendarAria")} className="p-2">
      <div className="flex h-12 items-center justify-between pl-2">
        <h2 className="text-[17px] leading-[1.5] font-bold text-fg" aria-live="polite">
          {formatThaiMonthYear(month)}
        </h2>
        <div className="flex">
          <IconButton icon={ChevronLeft} label={t("schedule.prevMonth")} onClick={onPrev} disabled={!canPrev} />
          <IconButton icon={ChevronRight} label={t("schedule.nextMonth")} onClick={onNext} disabled={!canNext} />
        </div>
      </div>

      <div className="grid grid-cols-7" aria-hidden="true">
        {studentScheduleCopy.daysOfWeek.map((day) => (
          <div key={day} className="flex h-8 items-center justify-center text-xs leading-[1.5] font-semibold text-fg-muted">
            {day}
          </div>
        ))}
      </div>

      <div className="grid touch-pan-y grid-cols-7 gap-y-0.5" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {cells.map((cell) => {
          const count = eventsByDate.get(cell.key)?.length ?? 0;
          const isSelected = isSameDay(cell.date, selected);
          const isToday = isSameDay(cell.date, today);
          const inMonth = cell.month === "curr";
          const label = count
            ? `${formatThaiDate(cell.date, "long")} ${t("schedule.hasClassAria")} ${count} ${t("schedule.classCountUnit")}`
            : formatThaiDate(cell.date, "long");
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelect(cell.date)}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={label}
              className="group/day flex h-11 items-center justify-center"
            >
              <span
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-full text-[15px] leading-none tabular-nums transition-colors duration-150",
                  isSelected
                    ? "bg-brand-solid font-bold text-white"
                    : cn(
                        "group-active/day:bg-press",
                        isToday && "font-bold text-brand-fg ring-2 ring-brand-vivid ring-inset",
                        !isToday && (inMonth ? "font-semibold text-fg" : "font-normal text-fg-muted"),
                      ),
                )}
              >
                {cell.day}
                {count ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-1 size-1.5 rounded-full",
                      isSelected ? "bg-white" : "bg-brand-vivid",
                    )}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </Surface>
  );
}
