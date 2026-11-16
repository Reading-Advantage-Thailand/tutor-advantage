"use client";

import { useMemo, useRef, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton, Surface } from "@/components/mobile";
import { formatThaiDate, formatThaiMonthYear, localDayToBangkokNoon } from "@/lib/format";
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
    <Surface
      as="section"
      padding="none"
      aria-label={t("schedule.calendarAria")}
      // Below 360px seven 44px day cells do not fit inside the gutter: the card runs edge to edge there.
      className="p-3 max-[359px]:-mx-4 max-[359px]:rounded-none max-[359px]:border-x-0 max-[359px]:px-0.5"
    >
      <div className="flex min-h-12 items-center justify-between pl-2">
        <h2 className="t-title text-fg" aria-live="polite">
          {formatThaiMonthYear(localDayToBangkokNoon(month))}
        </h2>
        <div className="flex gap-1">
          <IconButton icon={ChevronLeft} label={t("schedule.prevMonth")} onClick={onPrev} disabled={!canPrev} />
          <IconButton icon={ChevronRight} label={t("schedule.nextMonth")} onClick={onNext} disabled={!canNext} />
        </div>
      </div>

      <div className="mt-1 grid grid-cols-7" aria-hidden="true">
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
          // The cell is a device-local day; the formatter reads the Bangkok day.
          const dayName = formatThaiDate(localDayToBangkokNoon(cell.date), "long");
          const label = count
            ? `${dayName} ${t("schedule.hasClassAria")} ${count} ${t("schedule.classCountUnit")}`
            : dayName;
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
                  "relative flex size-10 items-center justify-center rounded-full text-[15px] leading-none tabular-nums transition-colors duration-[var(--duration-fast)]",
                  isSelected
                    ? "bg-brand-solid font-semibold text-on-brand shadow-[0_2px_0_var(--brand-solid-edge)]"
                    : cn(
                        "group-active/day:bg-press",
                        // Today: a ring in --brand-fg (patterns.md S11), plus the bolder weight.
                        isToday && "font-semibold text-brand-fg ring-2 ring-brand-fg ring-inset",
                        !isToday && (inMonth ? "font-medium text-fg" : "font-normal text-fg-muted"),
                      ),
                )}
              >
                {cell.day}
                {count ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-1 size-1.5 rounded-full",
                      isSelected ? "bg-on-brand" : "bg-brand-vivid",
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
