"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Notice, Sheet, toast } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import {
  MAX_CLASS_HOURS,
  WEEKLY_TEMPLATES,
  buildScheduleDescription,
  buildScheduleEntries,
  generateSchedule,
  normalizeScheduleData,
  splitPastSchedule,
  startOfLocalDay,
  templateToSlots,
  toLocalDateKey,
  totalScheduleHours,
  tryParseLocalDate,
  weeklyEntriesToSlots,
  type ScheduleTimes,
  type WeeklyTemplate,
} from "@/lib/tutorClassFlow";
import { rescheduleClass } from "../../actions";
import { ScheduleEditor } from "../../components/ScheduleEditor";

export interface RescheduleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className?: string;
  currentSchedule?: string;
  scheduleData?: unknown;
  initialStartsAt?: string | null;
  freeHours?: number;
}

type Draft = { genStart: string; dates: Date[]; times: ScheduleTimes };

/**
 * Builds the editor's starting state from the saved schedule. Handles both
 * saved shapes: dated sessions ({ date, start, end }) and the weekly
 * template ({ day, start, end }) used by older classes, which used to crash
 * the page (parseLocalDate(undefined)).
 */
function initialDraft(scheduleData: unknown, initialStartsAt: string | null | undefined, maxHours: number): Draft {
  const today = startOfLocalDay();
  // initialStartsAt may be a full ISO timestamp or a yyyy-MM-dd string;
  // take the date portion and parse it as a local date to avoid UTC shifts.
  const startDate = initialStartsAt ? tryParseLocalDate(String(initialStartsAt).slice(0, 10)) : null;
  const genStart = toLocalDateKey(startDate ?? today);
  const { dated, weekly } = normalizeScheduleData(scheduleData);

  if (dated.length > 0) {
    const times: ScheduleTimes = {};
    const dates = dated.map((entry) => {
      times[entry.date] = { start: entry.start, end: entry.end };
      return tryParseLocalDate(entry.date) as Date;
    });
    return { genStart, dates, times };
  }

  if (weekly.length > 0) {
    // Expand the weekly template into dated sessions from today (or the class start, if later).
    const from = startDate && startDate > today ? startDate : today;
    const generated = generateSchedule({ startDate: toLocalDateKey(from), slots: weeklyEntriesToSlots(weekly), maxHours });
    if (generated.dates.length > 0) return { genStart, ...generated };
  }

  // Nothing saved yet: pre-fill the first quick-pick template so the editor isn't empty.
  return { genStart, ...generateSchedule({ startDate: genStart, slots: templateToSlots(WEEKLY_TEMPLATES[0]), maxHours }) };
}

/** Reschedule sheet (lazy-loaded with the calendar on first open). */
export default function RescheduleSheet({
  open,
  onOpenChange,
  classId,
  className,
  currentSchedule,
  scheduleData,
  initialStartsAt,
  freeHours = 0,
}: RescheduleSheetProps) {
  const router = useRouter();
  const maxHours = MAX_CLASS_HOURS + (freeHours || 0);
  const [initial] = useState(() => initialDraft(scheduleData, initialStartsAt, maxHours));
  const [genStart, setGenStart] = useState(initial.genStart);
  const [selectedDates, setSelectedDates] = useState<Date[]>(initial.dates);
  const [dateTimes, setDateTimes] = useState<ScheduleTimes>(initial.times);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const today = startOfLocalDay();
  // Sessions already taught stay as they are and count towards the hours.
  const getPastSchedule = () => splitPastSchedule(normalizeScheduleData(scheduleData).dated, startOfLocalDay());

  const totalHours = useMemo(() => totalScheduleHours(selectedDates, dateTimes), [selectedDates, dateTimes]);
  const scheduleDescription = useMemo(() => buildScheduleDescription(selectedDates, dateTimes), [selectedDates, dateTimes]);
  const overLimit = totalHours > maxHours;

  const handleGenerate = (template: WeeklyTemplate) => {
    if (!genStart) return;
    const { dates, times } = generateSchedule({
      startDate: genStart,
      slots: templateToSlots(template),
      maxHours,
      keep: getPastSchedule(),
    });
    setSelectedDates(dates);
    setDateTimes(times);
    setErrorText("");
  };

  const handleSelectDates = (dates: Date[] | undefined) => {
    const past = getPastSchedule();
    const newValidDates = (dates || []).filter((d) => d >= today);
    setSelectedDates([...past.dates, ...newValidDates].sort((a, b) => a.getTime() - b.getTime()));
    setDateTimes((prev) => {
      const next = { ...past.times };
      newValidDates.forEach((d) => {
        const key = toLocalDateKey(d);
        next[key] = prev[key] || { start: "19:00", end: "21:00" };
      });
      return next;
    });
    setErrorText("");
  };

  const handleSave = async () => {
    if (!scheduleDescription) {
      setErrorText(t("tutorClass.newClass.scheduleRequired"));
      return;
    }
    if (overLimit) {
      setErrorText(t("tutorClass.newClass.hoursOverLimit"));
      return;
    }
    try {
      setLoading(true);
      const newScheduleData = buildScheduleEntries(selectedDates, dateTimes);
      await rescheduleClass(classId, {
        scheduleDescription,
        scheduleData: newScheduleData,
        startsAt: newScheduleData[0]?.date,
        endsAt: newScheduleData[newScheduleData.length - 1]?.date,
        totalHours,
      });
      onOpenChange(false);
      toast.success(t("tutorClass.ui.rescheduleSaved"));
      router.refresh();
    } catch (error) {
      setErrorText(error instanceof Error && error.message ? error.message : t("tutorClass.errors.reschedule"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("tutorClass.detail.rescheduleTitle")}
      description={t("tutorClass.detail.rescheduleDescription")}
      dismissible={!loading}
      width={880}
      footer={
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <p className="text-[0.8125rem] text-fg-muted md:mr-auto">{t("tutorClass.detail.rescheduleNotifyNote")}</p>
          {errorText ? (
            <p role="alert" className="text-[0.8125rem] font-medium text-danger-fg">
              {errorText}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 md:flex-row">
            <Button variant="ghost" size="lg" className="md:h-9" onClick={() => onOpenChange(false)} disabled={loading}>
              {t("tutorClass.detail.cancel")}
            </Button>
            <Button
              size="lg"
              className="md:h-9"
              onClick={handleSave}
              loading={loading}
              disabled={overLimit || selectedDates.length === 0}
            >
              {loading ? t("tutorClass.detail.saving") : t("tutorClass.detail.save")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {className && currentSchedule ? (
          <Notice tone="neutral" icon={CalendarDays} title={`${t("tutorClass.schedule.previousSchedule")} (${className})`}>
            {currentSchedule}
          </Notice>
        ) : null}
        <ScheduleEditor
          idPrefix="reschedule"
          columnsFrom="md"
          dates={selectedDates}
          times={dateTimes}
          totalHours={totalHours}
          maxHours={maxHours}
          freeHours={freeHours}
          genStart={genStart}
          onGenStartChange={setGenStart}
          onGenerate={handleGenerate}
          onClear={() => {
            const past = getPastSchedule();
            setSelectedDates(past.dates);
            setDateTimes(past.times);
          }}
          onSelectDates={handleSelectDates}
          onTimeChange={(key, field, value) =>
            setDateTimes((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
          }
          isDayDisabled={(date) => date < today}
          isLocked={(date) => date < today}
          preview={scheduleDescription}
        />
      </div>
    </Sheet>
  );
}
