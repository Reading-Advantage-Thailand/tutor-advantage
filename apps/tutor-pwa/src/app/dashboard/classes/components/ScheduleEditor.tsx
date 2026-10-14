"use client";

import dynamic from "next/dynamic";
import { CalendarDays, Eraser, Lock, Sparkles } from "lucide-react";
import { Chip, EmptyState, Field, ProgressBar, Skeleton, fieldControlClass } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
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
  loading: () => <Skeleton className="aspect-[7/6] w-full max-w-sm rounded-xl" />,
});

const DEFAULT_SLOT = { start: "19:00", end: "21:00" };

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
  columnsFrom?: "md" | "xl";
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
 * Shared "teaching days" editor for the new-class form and the reschedule
 * sheet: template generator, multi-select calendar, per-day times, hour
 * budget and the student-facing preview. Behaviour (state updates) stays in
 * the parent.
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

  return (
    <div className="flex flex-col gap-5">
      {/* Template generator */}
      <div className="flex flex-col gap-4 rounded-xl bg-surface-muted p-4">
        <div className="flex items-start gap-2">
          <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-fg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">{t("tutorClass.schedule.autoTitle")}</p>
            <p className="text-[0.8125rem] text-fg-muted">
              {t("tutorClass.schedule.autoHelpPrefix")} {maxHours} {t("tutorClass.newClass.hoursUnit")}
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
              className={cn(fieldControlClass, "h-10 max-w-xs pointer-coarse:h-11")}
            />
          )}
        </Field>
        <div role="group" aria-labelledby={`${idPrefix}-templates-label`} className="flex flex-col gap-2">
          <p id={`${idPrefix}-templates-label`} className="text-sm font-medium text-fg">
            {t("tutorClass.schedule.templatesLabel")}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {WEEKLY_TEMPLATES.map((template) => (
              <Button key={template.id} type="button" variant="outline" size="sm" className="h-auto min-h-8 flex-wrap justify-start gap-x-1.5 gap-y-0 py-1 whitespace-normal" onClick={() => onGenerate(template)}>
                {template.label}
                <span className="font-normal text-fg-muted">
                  {template.startTime}–{template.endTime}
                </span>
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" className="justify-start text-danger-fg hover:bg-danger-bg hover:text-danger-fg" onClick={onClear}>
              <Eraser aria-hidden="true" />
              {t("tutorClass.schedule.clearAll")}
            </Button>
          </div>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-5", columnsFrom === "md" ? "md:grid-cols-2" : "xl:grid-cols-2")}>
        {/* Calendar */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("text-sm font-medium", error ? "text-danger-fg" : "text-fg")}>{t("tutorClass.schedule.calendarLabel")}</p>
            <Chip tone={dates.length ? "brand" : "neutral"} size="sm">
              {dates.length ? `${t("tutorClass.schedule.selectedCountPrefix")} ${dates.length} ${t("tutorClass.schedule.daysUnit")}` : t("tutorClass.schedule.noneSelected")}
            </Chip>
          </div>
          <div
            className={cn(
              "flex justify-center rounded-xl border bg-surface p-3",
              error ? "border-danger-fg" : "border-hairline",
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
          {error ? <p className="text-[0.8125rem] text-danger-fg" role="alert">{error}</p> : null}
        </div>

        {/* Hours + per-day times */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-fg-muted">{t("tutorClass.newClass.totalHoursLabel")}</span>
              <span className={cn("font-semibold tabular", overLimit ? "text-danger-fg" : "text-fg")}>
                {totalHours} / {maxHours} {t("tutorClass.newClass.hoursUnit")}
              </span>
            </div>
            <ProgressBar
              value={maxHours > 0 ? (totalHours / maxHours) * 100 : 0}
              tone={overLimit ? "danger" : "brand"}
              label={t("tutorClass.newClass.totalHoursLabel")}
            />
            {freeHours > 0 ? (
              <dl className="grid grid-cols-2 gap-2 text-[0.8125rem]">
                <div>
                  <dt className="text-fg-muted">{t("tutorClass.newClass.regularHoursLabel")}</dt>
                  <dd className="font-semibold text-fg tabular">{MAX_CLASS_HOURS} {t("tutorClass.newClass.hoursUnit")}</dd>
                </div>
                <div>
                  <dt className="text-fg-muted">{t("tutorClass.newClass.couponHoursLabel")}</dt>
                  <dd className="font-semibold text-brand-fg tabular">{freeHours} {t("tutorClass.newClass.hoursUnit")}</dd>
                </div>
              </dl>
            ) : null}
            {overLimit ? (
              <p className="text-[0.8125rem] font-medium text-danger-fg" role="alert">
                {t("tutorClass.newClass.hoursOverLimit")}
              </p>
            ) : null}
          </div>

          {sorted.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-fg">{t("tutorClass.schedule.perDayTimes")}</p>
              <ul className="flex flex-col divide-y divide-hairline rounded-xl border border-hairline bg-surface">
                {sorted.map((date) => {
                  const key = toLocalDateKey(date);
                  const slot = times[key] || DEFAULT_SLOT;
                  const locked = isLocked?.(date) ?? false;
                  const label = dayLabel(date);
                  return (
                    <li key={key} className="flex items-center gap-2 px-3 py-2">
                      <span className="flex w-24 shrink-0 items-center gap-1.5 text-sm font-medium text-fg">
                        {locked ? <Lock aria-label={t("tutorClass.schedule.pastLocked")} className="size-3.5 text-fg-subtle" /> : null}
                        {label}
                      </span>
                      <select
                        aria-label={`${t("tutorClass.schedule.startTime")} ${label}`}
                        value={slot.start}
                        disabled={locked}
                        onChange={(event) => onTimeChange(key, "start", event.target.value)}
                        className={cn(fieldControlClass, "h-9 flex-1 px-2 pointer-coarse:h-10")}
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
                        className={cn(fieldControlClass, "h-9 flex-1 px-2 pointer-coarse:h-10")}
                      >
                        {withValue(getEndTimeOptions(slot.start), slot.end > slot.start ? slot.end : "").map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <EmptyState
              compact
              icon={CalendarDays}
              title={t("tutorClass.schedule.noneSelected")}
              description={t("tutorClass.schedule.emptyDates")}
              className="rounded-xl border border-dashed border-hairline-strong"
            />
          )}

          <div className="rounded-xl border border-brand-soft-border bg-brand-soft px-4 py-3">
            <p className="text-[0.8125rem] text-brand-fg">{t("tutorClass.newClass.previewLabel")}</p>
            <p className={cn("mt-0.5 text-sm", preview ? "font-medium text-fg" : "text-fg-muted")}>
              {preview || t("tutorClass.newClass.previewEmpty")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
