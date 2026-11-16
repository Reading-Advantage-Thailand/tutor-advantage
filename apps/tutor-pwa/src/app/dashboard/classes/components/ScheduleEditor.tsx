"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { CalendarDays, Eraser, Lock, Sparkles, X } from "lucide-react";
import { Chip, EmptyState, Field, ProgressBar, Skeleton, fieldControlClass } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import {
  CLASS_TIME_OPTIONS,
  MAX_CLASS_HOURS,
  WEEKLY_TEMPLATES,
  getEndTimeOptions,
  localDateToBangkokNoon,
  toLocalDateKey,
  tryParseLocalDate,
  type ScheduleTimes,
  type WeeklyTemplate,
} from "@/lib/tutorClassFlow";

const ThaiCalendar = dynamic(() => import("./ThaiCalendar"), {
  ssr: false,
  // h-auto: the aspect ratio sets the height (Skeleton defaults to h-4), so the
  // placeholder keeps the calendar's size while the chunk loads.
  loading: () => <Skeleton className="aspect-[7/6] h-auto w-full max-w-sm rounded-(--radius-ctl)" />,
});

const DEFAULT_SLOT = { start: "19:00", end: "21:00" };

/** Native time selects: 40 desktop, 44 on touch (components.md §0). */
const timeSelectClass = cn(fieldControlClass, "h-10 min-w-0 flex-1 cursor-pointer px-2.5 tabular pointer-coarse:h-11");

export interface ScheduleEditorProps {
  dates: Date[];
  times: ScheduleTimes;
  totalHours: number;
  /** Regular limit + coupon hours. */
  maxHours: number;
  freeHours?: number;
  /** "yyyy-MM-dd" start date for the template generator. */
  genStart: string;
  onGenStartChange: (value: string) => void;
  onGenerate: (template: WeeklyTemplate) => void;
  onClear: () => void;
  onSelectDates: (dates: Date[] | undefined) => void;
  onTimeChange: (key: string, field: "start" | "end", value: string) => void;
  /** Days that can't be clicked on the calendar. */
  isDayDisabled: (date: Date) => boolean;
  /** Sessions that are shown but can't be edited (already taught). */
  isLocked?: (date: Date) => boolean;
  /** Text stored as the schedule description (preview). */
  preview: string;
  error?: string;
  /** Lay the two columns out side by side from this breakpoint. */
  columnsFrom?: "lg" | "xl";
  idPrefix: string;
}

/** Hourly options plus the saved value (e.g. "19:30" from an older schedule) so the select never shows a wrong time. */
function withValue(options: string[], value: string) {
  return value && !options.includes(value) ? [...options, value].sort() : options;
}

function dayLabel(date: Date) {
  return formatThaiDate(localDateToBangkokNoon(date), "weekdayShort");
}

/**
 * Shared "teaching days" editor for the new-class form, the class setup form
 * and the reschedule sheet (patterns.md T4): the template generator in a
 * well, the multi-select calendar, the hour budget, the per-day time rows
 * (start – end + a 44px remove button) and the student-facing preview.
 * Behaviour (state updates) stays in the parent; removing a row calls
 * `onSelectDates` without that day, exactly like un-ticking it on the
 * calendar, and locked (already taught) days cannot be removed.
 */
export function ScheduleEditor({
  dates,
  times,
  totalHours,
  maxHours,
  freeHours = 0,
  genStart,
  onGenStartChange,
  onGenerate,
  onClear,
  onSelectDates,
  onTimeChange,
  isDayDisabled,
  isLocked,
  preview,
  error,
  columnsFrom = "xl",
  idPrefix,
}: ScheduleEditorProps) {
  const overLimit = totalHours > maxHours;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const genStartDate = tryParseLocalDate(genStart);
  const timesColumnRef = useRef<HTMLDivElement>(null);

  /**
   * Removes one day. Focus moves first, while the row still exists, to the next
   * removable day's button (else the previous one, else the times column), so
   * it never drops to <body> when the row unmounts (where a sheet's focus guard
   * would take it). Buttons are matched by day, since locked rows have none.
   */
  const removeDay = (key: string) => {
    const column = timesColumnRef.current;
    const buttons = column ? Array.from(column.querySelectorAll<HTMLButtonElement>("[data-remove-day]")) : [];
    const index = buttons.findIndex((button) => button.dataset.removeDay === key);
    const next = index >= 0 ? (buttons[index + 1] ?? buttons[index - 1]) : undefined;
    (next ?? column)?.focus();
    onSelectDates(dates.filter((date) => toLocalDateKey(date) !== key));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Template generator */}
      <div className="ds-well flex flex-col gap-4 p-4">
        <div className="flex items-start gap-2.5">
          <Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-fg" />
          <div className="min-w-0">
            <p className="type-card text-fg">{t("tutorClass.schedule.autoTitle")}</p>
            {/* One string through thaiCopy: "จนครบ 22 ชม." stays on one line. */}
            <p className="type-body-s text-fg-muted tabular">
              {thaiCopy(`${t("tutorClass.schedule.autoHelpPrefix")} ${maxHours} ${t("tutorClass.newClass.hoursUnit")}`)}
            </p>
          </div>
        </div>
        <Field
          id={`${idPrefix}-gen-start`}
          label={t("tutorClass.schedule.startDateLabel")}
          hint={genStartDate ? formatThaiDate(localDateToBangkokNoon(genStartDate), "full") : t("tutorClass.schedule.startDateHint")}
        >
          {({ id, describedBy }) => (
            <input
              id={id}
              type="date"
              lang="th"
              value={genStart}
              aria-describedby={describedBy}
              onChange={(event) => onGenStartChange(event.target.value)}
              className={cn(fieldControlClass, "h-11 max-w-xs pointer-coarse:h-12")}
            />
          )}
        </Field>
        <div role="group" aria-labelledby={`${idPrefix}-templates-label`} className="flex flex-col gap-2">
          <p id={`${idPrefix}-templates-label`} className="type-label text-fg">
            {t("tutorClass.schedule.templatesLabel")}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEEKLY_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                type="button"
                variant="outline"
                className="h-auto min-h-14 flex-col items-start justify-center gap-0 px-3 py-2 text-left whitespace-normal"
                onClick={() => onGenerate(template)}
              >
                <span>{template.label}</span>
                <span className="text-[0.8125rem] font-normal text-fg-muted tabular">
                  {template.startTime}–{template.endTime}
                </span>
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="self-start text-danger-fg hover:bg-danger-bg hover:text-danger-fg"
            onClick={onClear}
          >
            <Eraser aria-hidden="true" />
            {t("tutorClass.schedule.clearAll")}
          </Button>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-5", columnsFrom === "lg" ? "lg:grid-cols-2" : "xl:grid-cols-2")}>
        {/* Calendar: stays in view beside a long list of days in the two-column layout. */}
        <div
          className={cn(
            "flex min-w-0 flex-col gap-2",
            columnsFrom === "lg" ? "lg:sticky lg:top-6 lg:self-start" : "xl:sticky xl:top-6 xl:self-start",
          )}
        >
          <div className="flex min-h-7 items-center justify-between gap-2">
            <p className={cn("type-label", error ? "text-danger-fg" : "text-fg")}>{t("tutorClass.schedule.calendarLabel")}</p>
            <Chip tone={dates.length ? "brand" : "neutral"} dot={dates.length > 0}>
              {dates.length ? (
                <span className="tabular">
                  {t("tutorClass.schedule.selectedCountPrefix")} {dates.length} {t("tutorClass.schedule.daysUnit")}
                </span>
              ) : (
                t("tutorClass.schedule.noneSelected")
              )}
            </Chip>
          </div>
          {/* A size container: ThaiCalendar sizes its day cells from this card's width.
              Slim padding on phones leaves room for 44px days at 390px. */}
          <div
            className={cn(
              "@container flex justify-center rounded-(--radius-ctl) border bg-surface p-1.5 sm:p-3",
              error ? "border-danger-solid" : "border-clay-rim",
            )}
          >
            <ThaiCalendar
              mode="multiple"
              defaultMonth={sorted[0] || new Date()}
              selected={dates}
              onSelect={onSelectDates}
              disabled={isDayDisabled}
            />
          </div>
          {error ? (
            <p className="type-body-s text-danger-fg" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {/* Hours + per-day times. Focus lands here when the last removable day goes, so it shows the ring. */}
        <div
          ref={timesColumnRef}
          tabIndex={-1}
          className="flex min-w-0 flex-col gap-4 rounded-(--radius-ctl) outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring"
        >
          <div className="ds-well flex flex-col gap-2 px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="type-label text-fg-muted">
                {t("tutorClass.newClass.totalHoursLabel")}
              </span>
              <span className={cn("text-base font-semibold tabular", overLimit ? "text-danger-fg" : "text-fg")}>
                {totalHours} / {maxHours} {t("tutorClass.newClass.hoursUnit")}
              </span>
            </div>
            <ProgressBar
              value={maxHours > 0 ? (totalHours / maxHours) * 100 : 0}
              tone={overLimit ? "danger" : "brand"}
              label={t("tutorClass.newClass.totalHoursLabel")}
            />
            {freeHours > 0 ? (
              <dl className="mt-1 grid grid-cols-2 gap-2 type-body-s">
                <div>
                  <dt className="text-fg-muted">{t("tutorClass.newClass.regularHoursLabel")}</dt>
                  <dd className="font-semibold text-fg tabular">
                    {MAX_CLASS_HOURS} {t("tutorClass.newClass.hoursUnit")}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-muted">{t("tutorClass.newClass.couponHoursLabel")}</dt>
                  <dd className="font-semibold text-brand-fg tabular">
                    {freeHours} {t("tutorClass.newClass.hoursUnit")}
                  </dd>
                </div>
              </dl>
            ) : null}
            {overLimit ? (
              <p className="type-body-s font-medium text-danger-fg" role="alert">
                {t("tutorClass.newClass.hoursOverLimit")}
              </p>
            ) : null}
          </div>

          {sorted.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p id={`${idPrefix}-per-day`} className="type-label text-fg">
                {t("tutorClass.schedule.perDayTimes")}
              </p>
              {/* A size container: in a narrow column (phones, the two-column layout)
                  the day sits above its times; from 384px it is one line. */}
              <ul
                aria-labelledby={`${idPrefix}-per-day`}
                className="@container overflow-hidden rounded-(--radius-ctl) border border-clay-rim bg-surface"
              >
                {sorted.map((date, index) => {
                  const key = toLocalDateKey(date);
                  const slot = times[key] || DEFAULT_SLOT;
                  const locked = isLocked?.(date) ?? false;
                  const label = dayLabel(date);
                  return (
                    <li
                      key={key}
                      className={cn(
                        "flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 @sm:flex-nowrap",
                        index > 0 && "border-t border-hairline",
                        locked && "bg-surface-muted",
                      )}
                    >
                      <span className="flex basis-full items-center gap-1.5 text-sm font-semibold text-fg @sm:w-28 @sm:shrink-0 @sm:basis-auto">
                        {locked ? <Lock aria-label={t("tutorClass.schedule.pastLocked")} className="size-3.5 text-fg-subtle" /> : null}
                        {label}
                      </span>
                      <select
                        aria-label={`${t("tutorClass.schedule.startTime")} ${label}`}
                        value={slot.start}
                        disabled={locked}
                        onChange={(event) => onTimeChange(key, "start", event.target.value)}
                        className={timeSelectClass}
                      >
                        {withValue(CLASS_TIME_OPTIONS, slot.start).map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <span aria-hidden="true" className="text-fg-subtle">–</span>
                      <select
                        aria-label={`${t("tutorClass.schedule.endTime")} ${label}`}
                        value={slot.end}
                        disabled={locked}
                        onChange={(event) => onTimeChange(key, "end", event.target.value)}
                        className={timeSelectClass}
                      >
                        {withValue(getEndTimeOptions(slot.start), slot.end > slot.start ? slot.end : "").map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      {locked ? (
                        // Keeps the columns aligned with the removable rows.
                        <span aria-hidden="true" className="size-10 shrink-0 pointer-coarse:size-11" />
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          data-remove-day={key}
                          aria-label={`${t("tutorClass.classPages.removeDay")} ${label}`}
                          onClick={() => removeDay(key)}
                          className="hover:bg-danger-bg hover:text-danger-fg"
                        >
                          <X aria-hidden="true" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <EmptyState
              compact
              icon={CalendarDays}
              tone="purple"
              title={t("tutorClass.schedule.noneSelected")}
              description={t("tutorClass.schedule.emptyDates")}
              className="ds-well py-6"
            />
          )}

          <div className="rounded-(--radius-ctl) border border-brand-soft-border bg-brand-soft px-4 py-3">
            <p className="type-caption font-medium text-brand-soft-fg">{t("tutorClass.newClass.previewLabel")}</p>
            <p className={cn("mt-0.5 type-body-s", preview ? "font-semibold text-fg" : "text-fg-muted")}>
              {preview || t("tutorClass.newClass.previewEmpty")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
