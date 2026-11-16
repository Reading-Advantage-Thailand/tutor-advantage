"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BookOpen, CalendarDays, CheckCircle2, ExternalLink, Link2, Ticket } from "lucide-react";
import { SelectField, StickyActions, TextField } from "@/components/app";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { scrollBehavior } from "@/lib/motion";
import { thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import {
  MAX_CLASS_HOURS,
  buildScheduleDescription,
  buildScheduleEntries,
  generateSchedule,
  startOfLocalDay,
  templateToSlots,
  toLocalDateKey,
  totalScheduleHours,
  type ScheduleTimes,
  type WeeklyTemplate,
} from "@/lib/tutorClassFlow";
import { createClass, validateCoupon } from "../actions";
import { bookDisplayLabel, groupBooksByProgram, type BookOption } from "../components/book-options";
import { FormSection } from "../components/FormSection";
import { ScheduleEditor } from "../components/ScheduleEditor";

export function NewClassForm({ books }: { books: BookOption[] }) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const bookRef = useRef<HTMLSelectElement>(null);
  const scheduleRef = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [form, setForm] = useState({
    name: "",
    book: "",
    meetingUrl: "",
    couponCode: "",
  });

  const [couponChecking, setCouponChecking] = useState(false);
  const [couponHours, setCouponHours] = useState<number | null>(null);
  const [couponError, setCouponError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const booksByProgram = useMemo(() => groupBooksByProgram(books, "bookCode"), [books]);

  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [dateTimes, setDateTimes] = useState<ScheduleTimes>({});
  const [genStart, setGenStart] = useState("");

  useEffect(() => {
    // Local "today" is only known in the browser (the server runs in UTC).
    setGenStart(toLocalDateKey(new Date()));
  }, []);

  const freeHours = couponHours ?? 0;
  const maxHours = MAX_CLASS_HOURS + freeHours;
  const totalHours = useMemo(() => totalScheduleHours(selectedDates, dateTimes), [selectedDates, dateTimes]);
  const schedule = useMemo(() => buildScheduleDescription(selectedDates, dateTimes), [selectedDates, dateTimes]);
  const overLimit = totalHours > maxHours;

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleGenerate = (template: WeeklyTemplate) => {
    if (!genStart) return;
    // Generate dates until we hit maxHours exactly (22 hours + coupon hours).
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

  const handleCheckCoupon = async () => {
    const code = form.couponCode.trim();
    if (!code) return;
    setCouponChecking(true);
    setCouponError("");
    setCouponHours(null);
    try {
      const result = await validateCoupon(code);
      setCouponHours(result.hours);
    } catch (err) {
      setCouponError(err instanceof Error && err.message ? err.message : t("tutorClass.errors.coupon"));
    } finally {
      setCouponChecking(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = t("tutorClass.form.nameRequired");
    if (!form.book) newErrors.book = t("tutorClass.form.bookRequired");
    if (!schedule) newErrors.schedule = t("tutorClass.form.scheduleRequired");
    if (overLimit) newErrors.schedule = t("tutorClass.newClass.hoursOverLimit");
    setFieldErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setErrorText(t("tutorClass.form.fixErrors"));
      if (newErrors.name) nameRef.current?.focus();
      else if (newErrors.book) bookRef.current?.focus();
      else scheduleRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      return;
    }

    setLoading(true);
    setErrorText("");
    try {
      const scheduleData = buildScheduleEntries(selectedDates, dateTimes);
      const startsAt = scheduleData[0]?.date ?? "";
      const endsAt = scheduleData[scheduleData.length - 1]?.date ?? "";
      await createClass({ ...form, schedule, scheduleData, startsAt, endsAt, totalHours });
      router.push("/dashboard/classes");
      router.refresh();
    } catch (error) {
      setErrorText(error instanceof Error && error.message ? error.message : t("tutorClass.newClass.createFailed"));
      setLoading(false);
    }
  };

  const today = startOfLocalDay();

  return (
    <form id="create-class-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 md:gap-5">
      {/* 1. What the class is (required) */}
      <FormSection
        id="new-class-info"
        icon={BookOpen}
        title={t("tutorClass.newClass.classInfo")}
        description={t("tutorClass.classPages.infoHelp")}
      >
        <div className="flex flex-col gap-4">
          <TextField
            ref={nameRef}
            id="class-name"
            label={t("tutorClass.newClass.className")}
            placeholder={t("tutorClass.newClass.classNamePlaceholder")}
            required
            value={form.name}
            error={fieldErrors.name}
            onChange={(event) => {
              setForm({ ...form, name: event.target.value });
              clearFieldError("name");
            }}
          />
          <SelectField
            ref={bookRef}
            id="book"
            label={t("tutorClass.newClass.book")}
            required
            value={form.book}
            error={fieldErrors.book}
            placeholder={t("tutorClass.newClass.selectBook")}
            onChange={(event) => {
              setForm({ ...form, book: event.target.value });
              clearFieldError("book");
            }}
          >
            {booksByProgram.reading.length > 0 && (
              <optgroup label="Reading Advantage">
                {booksByProgram.reading.map((book) => (
                  <option key={book.bookId} value={book.bookId}>
                    {bookDisplayLabel(book)}
                  </option>
                ))}
              </optgroup>
            )}
            {booksByProgram.primary.length > 0 && (
              <optgroup label="Primary Advantage">
                {booksByProgram.primary.map((book) => (
                  <option key={book.bookId} value={book.bookId}>
                    {bookDisplayLabel(book)}
                  </option>
                ))}
              </optgroup>
            )}
          </SelectField>
        </div>
      </FormSection>

      {/* 2. Coupon hours: before the schedule because they raise its hour budget. */}
      <FormSection
        id="new-class-coupon"
        icon={Ticket}
        tone="amber"
        title={t("tutorClass.newClass.couponTitle")}
        description={t("tutorClass.newClass.couponHelp")}
      >
        <div className="flex items-start gap-2">
          <TextField
            id="coupon-code"
            label={t("tutorClass.newClass.couponLabel")}
            placeholder={t("tutorClass.newClass.couponPlaceholder")}
            containerClassName="flex-1"
            className="font-mono uppercase"
            autoCapitalize="characters"
            value={form.couponCode}
            error={couponError || undefined}
            onChange={(event) => {
              setForm({ ...form, couponCode: event.target.value });
              setCouponHours(null);
              setCouponError("");
            }}
          />
          {/* Lines up with the input: the label line + the field's 6px gap. */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-[1.6875rem] pointer-coarse:min-h-12"
            onClick={handleCheckCoupon}
            loading={couponChecking}
            disabled={!form.couponCode.trim()}
          >
            {couponChecking ? t("tutorClass.newClass.couponChecking") : t("tutorClass.newClass.couponCheck")}
          </Button>
        </div>
        {couponHours !== null && (
          <p className="mt-3 flex items-center gap-1.5 type-label text-success-fg" role="status">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            <span>
              {t("tutorClass.newClass.couponValid")}: <span className="font-semibold tabular">{couponHours}</span>{" "}
              {t("tutorClass.newClass.couponHoursUnit")}
            </span>
          </p>
        )}
      </FormSection>

      {/* 3. Teaching days (required) */}
      <FormSection
        ref={scheduleRef}
        id="new-class-schedule"
        icon={CalendarDays}
        tone="purple"
        required
        title={t("tutorClass.schedule.sectionTitle")}
      >
        <ScheduleEditor
          idPrefix="new-class"
          columnsFrom="lg"
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
      </FormSection>

      {/* 4. Online room link (optional) */}
      <FormSection id="new-class-meeting" icon={Link2} tone="blue" title={t("tutorClass.newClass.meetingUrlTitle")}>
        <div className="flex flex-col gap-3">
          <TextField
            id="meeting-url"
            type="url"
            inputMode="url"
            optional
            label={t("tutorClass.newClass.meetingUrlProviderLabel")}
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
            hint={t("tutorClass.newClass.meetingUrlHelp")}
            value={form.meetingUrl}
            onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })}
          />
          <div className="ds-well flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="type-body-s text-fg-muted sm:mr-auto">{t("tutorClass.newClass.quickCreate")}</span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => window.open("https://meet.google.com/new", "_blank")}>
                Google Meet
                <ExternalLink aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" onClick={() => window.open("https://zoom.us/start/videoconference", "_blank")}>
                Zoom
                <ExternalLink aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </FormSection>

      <StickyActions className="flex-col items-stretch gap-3 md:flex-row md:items-center">
        {errorText ? (
          <p role="alert" className="flex items-start gap-1.5 type-label text-danger-fg md:mr-auto">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{errorText}</span>
          </p>
        ) : (
          <p className="hidden type-body-s text-fg-muted md:mr-auto md:block">
            {selectedDates.length ? (
              <span className="tabular">
                {totalHours} / {maxHours} {t("tutorClass.newClass.hoursUnit")}
              </span>
            ) : (
              t("tutorClass.form.footerHint")
            )}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Link href="/dashboard/classes" className={cn(buttonVariants({ variant: "outline", size: "xl" }), "md:h-11")}>
            {t("shell.cancel")}
          </Link>
          <Button
            id="btn-submit-create-class"
            type="submit"
            size="xl"
            className="h-auto min-h-12 flex-1 py-2 whitespace-normal md:h-11 md:min-h-0 md:flex-none md:py-0"
            loading={loading}
            disabled={overLimit}
          >
            {/* One flex item, so "Referral Link" stays whole when the label wraps (same accessible name). */}
            <span className="min-w-0">{thaiLabel(loading ? t("tutorClass.newClass.creating") : t("tutorClass.newClass.submit"))}</span>
          </Button>
        </div>
      </StickyActions>
    </form>
  );
}
