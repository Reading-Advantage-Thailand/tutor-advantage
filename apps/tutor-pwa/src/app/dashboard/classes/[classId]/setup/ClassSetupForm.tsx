"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, ExternalLink, Link2, Lock } from "lucide-react";
import { Card, CardHeader, IconTile, StickyActions, TextField, toast } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import {
  MAX_CLASS_HOURS,
  MAX_CLASS_TITLE_LENGTH,
  buildScheduleDescription,
  buildSetupClassRequest,
  generateSchedule,
  getClassSetupErrorMessage,
  startOfLocalDay,
  templateToSlots,
  toLocalDateKey,
  totalScheduleHours,
  validateClassSetup,
  type ClassSetupErrors,
  type ScheduleTimes,
  type WeeklyTemplate,
} from "@/lib/tutorClassFlow";
import { setupClass } from "../../actions";
import { ScheduleEditor } from "../../components/ScheduleEditor";

export interface ClassSetupFormProps {
  classId: string;
  initialName: string;
  /** Display name of the book the admin picked (read-only here). */
  bookLabel: string;
  initialMeetingUrl?: string;
  freeHours?: number;
}

/**
 * Setup form for a class an admin created on the tutor's behalf. Same layout
 * as the new-class form (NewClassForm), minus the coupon: the book is fixed
 * because students have already paid for it.
 */
export function ClassSetupForm({ classId, initialName, bookLabel, initialMeetingUrl = "", freeHours = 0 }: ClassSetupFormProps) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const meetingUrlRef = useRef<HTMLInputElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [form, setForm] = useState({ name: initialName, meetingUrl: initialMeetingUrl });
  const [fieldErrors, setFieldErrors] = useState<ClassSetupErrors>({});

  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [dateTimes, setDateTimes] = useState<ScheduleTimes>({});
  const [genStart, setGenStart] = useState("");

  useEffect(() => {
    // Local "today" is only known in the browser (the server runs in UTC).
    setGenStart(toLocalDateKey(new Date()));
  }, []);

  const maxHours = MAX_CLASS_HOURS + freeHours;
  const totalHours = useMemo(() => totalScheduleHours(selectedDates, dateTimes), [selectedDates, dateTimes]);
  const schedule = useMemo(() => buildScheduleDescription(selectedDates, dateTimes), [selectedDates, dateTimes]);
  const overLimit = totalHours > maxHours;
  const classHref = `/dashboard/classes/${classId}`;

  const clearFieldError = (field: keyof ClassSetupErrors) => {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleGenerate = (template: WeeklyTemplate) => {
    if (!genStart) return;
    const { dates, times } = generateSchedule({ startDate: genStart, slots: templateToSlots(template), maxHours });
    setSelectedDates(dates);
    setDateTimes(times);
    clearFieldError("schedule");
  };

  const handleSelectDates = (dates: Date[] | undefined) => {
    const newDates = dates || [];
    setSelectedDates(newDates);
    setDateTimes((prev) => {
      const next = { ...prev };
      newDates.forEach((d) => {
        const key = toLocalDateKey(d);
        if (!next[key]) next[key] = { start: "19:00", end: "21:00" };
      });
      return next;
    });
    clearFieldError("schedule");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const draft = { name: form.name, meetingUrl: form.meetingUrl, dates: selectedDates, times: dateTimes };
    const newErrors = validateClassSetup(draft, maxHours);
    setFieldErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setErrorText(t("tutorClass.setup.fixErrors"));
      if (newErrors.name) nameRef.current?.focus();
      else if (newErrors.meetingUrl) meetingUrlRef.current?.focus();
      else scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setLoading(true);
    setErrorText("");
    try {
      const result = await setupClass(classId, buildSetupClassRequest(draft));
      if (result.ok || result.code === "CLASS_SETUP_NOT_REQUIRED") {
        // A double submit lands here too: the class is set up either way.
        if (result.ok) toast.success(t("tutorClass.setup.saved"));
        else toast.info(t("tutorClass.setup.alreadyDone"));
        router.replace(classHref);
        router.refresh();
        return;
      }
      setErrorText(getClassSetupErrorMessage(result.code));
    } catch {
      setErrorText(t("tutorClass.setup.errorFailed"));
    }
    setLoading(false);
  };

  const today = startOfLocalDay();

  return (
    <form id="class-setup-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <Card as="section" aria-labelledby="class-setup-info">
        <CardHeader
          icon={<IconTile icon={BookOpen} size="sm" />}
          title={<span id="class-setup-info">{t("tutorClass.newClass.classInfo")}</span>}
        />
        <div className="flex flex-col gap-4">
          <TextField
            ref={nameRef}
            id="class-name"
            label={t("tutorClass.newClass.className")}
            placeholder={t("tutorClass.newClass.classNamePlaceholder")}
            required
            maxLength={MAX_CLASS_TITLE_LENGTH}
            value={form.name}
            error={fieldErrors.name}
            onChange={(event) => {
              setForm({ ...form, name: event.target.value });
              clearFieldError("name");
            }}
          />
          <TextField
            id="book"
            label={t("tutorClass.newClass.book")}
            readOnly
            value={bookLabel}
            hint={t("tutorClass.setup.bookLocked")}
            className="bg-surface-muted text-fg-muted"
            endAddon={<Lock aria-hidden="true" className="size-4" />}
          />
        </div>
      </Card>

      <Card as="section" aria-labelledby="class-setup-meeting">
        <CardHeader
          icon={<IconTile icon={Link2} size="sm" tone="blue" />}
          title={<span id="class-setup-meeting">{t("tutorClass.newClass.meetingUrlTitle")}</span>}
        />
        <div className="flex flex-col gap-3">
          <TextField
            ref={meetingUrlRef}
            id="meeting-url"
            type="url"
            inputMode="url"
            optional
            label={t("tutorClass.newClass.meetingUrlProviderLabel")}
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
            hint={t("tutorClass.newClass.meetingUrlHelp")}
            value={form.meetingUrl}
            error={fieldErrors.meetingUrl}
            onChange={(event) => {
              setForm({ ...form, meetingUrl: event.target.value });
              clearFieldError("meetingUrl");
            }}
          />
          <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-fg-muted">
            <span>{t("tutorClass.newClass.quickCreate")}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => window.open("https://meet.google.com/new", "_blank")}>
              Google Meet
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => window.open("https://zoom.us/start/videoconference", "_blank")}>
              Zoom
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <Card as="section" aria-labelledby="class-setup-schedule">
        <div ref={scheduleRef} className="scroll-mt-24">
          <CardHeader
            icon={<IconTile icon={CalendarDays} size="sm" tone="blue" />}
            title={
              <span id="class-setup-schedule">
                {t("tutorClass.schedule.sectionTitle")}
                <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span>
              </span>
            }
            description={t("tutorClass.setup.notifyNote")}
          />
          <ScheduleEditor
            idPrefix="class-setup"
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
              setSelectedDates([]);
              setDateTimes({});
            }}
            onSelectDates={handleSelectDates}
            onTimeChange={(key, field, value) =>
              setDateTimes((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
            }
            isDayDisabled={(date) => date < today}
            preview={schedule}
            error={fieldErrors.schedule}
          />
        </div>
      </Card>

      <StickyActions className="flex-col items-stretch md:flex-row md:items-center">
        {errorText ? (
          <p role="alert" className="text-[0.8125rem] font-medium text-danger-fg md:mr-auto">
            {errorText}
          </p>
        ) : (
          <p className="hidden text-[0.8125rem] text-fg-muted md:mr-auto md:block">
            {selectedDates.length
              ? `${totalHours} / ${maxHours} ${t("tutorClass.newClass.hoursUnit")}`
              : t("tutorClass.setup.footerHint")}
          </p>
        )}
        <Button
          id="btn-submit-class-setup"
          type="submit"
          size="lg"
          className="w-full md:w-auto"
          loading={loading}
          disabled={overLimit}
        >
          {loading ? t("tutorClass.setup.saving") : t("tutorClass.setup.submit")}
        </Button>
      </StickyActions>
    </form>
  );
}
