"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, CheckCircle2, ExternalLink, Link2, Ticket } from "lucide-react";
import {
  Card,
  CardHeader,
  IconTile,
  SelectField,
  StickyActions,
  TextField,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
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
import { groupBooksByProgram, type BookOption } from "../components/book-options";
import { ScheduleEditor } from "../components/ScheduleEditor";

const bookLabel = (book: BookOption) =>
  String(book.bookCode || "").startsWith("Primary ")
    ? String(book.title || "").replace(/\s*\([A-C]\d\)$/i, "")
    : book.title;

export function NewClassForm({ books }: { books: BookOption[] }) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const bookRef = useRef<HTMLSelectElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
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
      else scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    <form id="create-class-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <Card as="section" aria-labelledby="new-class-info">
        <CardHeader
          icon={<IconTile icon={BookOpen} size="sm" />}
          title={<span id="new-class-info">{t("tutorClass.newClass.classInfo")}</span>}
        />
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
                    {bookLabel(book)}
                  </option>
                ))}
              </optgroup>
            )}
            {booksByProgram.primary.length > 0 && (
              <optgroup label="Primary Advantage">
                {booksByProgram.primary.map((book) => (
                  <option key={book.bookId} value={book.bookId}>
                    {bookLabel(book)}
                  </option>
                ))}
              </optgroup>
            )}
          </SelectField>
        </div>
      </Card>

      <Card as="section" aria-labelledby="new-class-meeting">
        <CardHeader
          icon={<IconTile icon={Link2} size="sm" tone="blue" />}
          title={<span id="new-class-meeting">{t("tutorClass.newClass.meetingUrlTitle")}</span>}
        />
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

      <Card as="section" aria-labelledby="new-class-coupon">
        <CardHeader
          icon={<IconTile icon={Ticket} size="sm" tone="amber" />}
          title={<span id="new-class-coupon">{t("tutorClass.newClass.couponTitle")}</span>}
          description={t("tutorClass.newClass.couponHelp")}
        />
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
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-[1.6875rem]"
            onClick={handleCheckCoupon}
            loading={couponChecking}
            disabled={!form.couponCode.trim()}
          >
            {couponChecking ? t("tutorClass.newClass.couponChecking") : t("tutorClass.newClass.couponCheck")}
          </Button>
        </div>
        {couponHours !== null && (
          <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem] font-medium text-success-fg" role="status">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {t("tutorClass.newClass.couponValid")}: {couponHours} {t("tutorClass.newClass.couponHoursUnit")}
          </p>
        )}
      </Card>

      <Card as="section" aria-labelledby="new-class-schedule">
        <div ref={scheduleRef} className="scroll-mt-24">
          <CardHeader
            icon={<IconTile icon={CalendarDays} size="sm" tone="blue" />}
            title={
              <span id="new-class-schedule">
                {t("tutorClass.schedule.sectionTitle")}
                <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span>
              </span>
            }
          />
          <ScheduleEditor
            idPrefix="new-class"
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
              : t("tutorClass.form.footerHint")}
          </p>
        )}
        <Button
          id="btn-submit-create-class"
          type="submit"
          size="lg"
          className="w-full md:w-auto"
          loading={loading}
          disabled={overLimit}
        >
          {loading ? t("tutorClass.newClass.creating") : t("tutorClass.newClass.submit")}
        </Button>
      </StickyActions>
    </form>
  );
}
