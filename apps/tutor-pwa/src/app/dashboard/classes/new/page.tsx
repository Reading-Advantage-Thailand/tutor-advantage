"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, BookOpen, Calendar, Link2, Clock, ExternalLink, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { createClass, getBooks } from "../actions";
import { t } from "@/lib/i18n";
import {
  buildScheduleString,
  calculateTotalHours,
  CLASS_DAYS,
  CLASS_TIME_OPTIONS,
  getEndTimeOptions,
  MAX_CLASS_HOURS,
  toggleClassDay,
  WEEKLY_TEMPLATES,
} from "@/lib/tutorClassFlow";

export default function NewClassPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD for min attr (local TZ doesn't matter for date inputs)

  const [form, setForm] = useState({
    name: "",
    book: "",
    schedule: "",
    meetingUrl: "",
    startsAt: "",
    endsAt: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [books, setBooks] = useState<any[]>([]);

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("21:00");

  useEffect(() => {
    const schedule = buildScheduleString(selectedDays, startTime, endTime);
    setForm((prev) => ({ ...prev, schedule }));
  }, [selectedDays, startTime, endTime]);

  const totalHours = useMemo(
    () => calculateTotalHours(selectedDays, startTime, endTime, form.startsAt, form.endsAt),
    [selectedDays, startTime, endTime, form.startsAt, form.endsAt],
  );
  const overLimit = totalHours > MAX_CLASS_HOURS;
  const hoursPct = Math.min(100, (totalHours / MAX_CLASS_HOURS) * 100);

  const applyTemplate = (tpl: (typeof WEEKLY_TEMPLATES)[number]) => {
    setSelectedDays(tpl.days);
    setStartTime(tpl.startTime);
    setEndTime(tpl.endTime);
    clearFieldError("schedule");
  };

  useEffect(() => {
    async function loadBooks() {
      try {
        const data = await getBooks();
        setBooks(data.books || []);
      } catch (err) {
        console.error("Error loading books:", err);
      }
    }
    loadBooks();
  }, []);

  const toggleDay = (value: string) => {
    setSelectedDays((prev) => toggleClassDay(prev, value));
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = t("tutorClass.newClass.classNamePlaceholder") + " (จำเป็น)";
    if (!form.book) newErrors.book = t("tutorClass.newClass.selectBook") + " (จำเป็น)";
    if (!form.schedule) newErrors.schedule = t("tutorClass.newClass.scheduleRequired");
    if (overLimit) newErrors.schedule = t("tutorClass.newClass.hoursOverLimit");
    setFieldErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setLoading(true);
    setErrorText("");
    try {
      await createClass({ ...form, totalHours });
      router.push("/dashboard/classes");
      router.refresh();
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setErrorText(error.message || t("tutorClass.newClass.createFailed"));
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl pb-24 lg:pb-0">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/classes">
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t("tutorClass.newClass.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("tutorClass.newClass.subtitle")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 flex-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                {t("tutorClass.newClass.classInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="class-name">{t("tutorClass.newClass.className")}</Label>
                <Input
                  id="class-name"
                  placeholder={t("tutorClass.newClass.classNamePlaceholder")}
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); clearFieldError("name"); }}
                  className={fieldErrors.name ? "border-destructive focus-visible:ring-destructive/30" : ""}
                />
                {fieldErrors.name && (
                  <p className="text-xs text-destructive font-semibold">{fieldErrors.name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="book">{t("tutorClass.newClass.book")}</Label>
                <select
                  id="book"
                  value={form.book}
                  onChange={(e) => { setForm({ ...form, book: e.target.value }); clearFieldError("book"); }}
                  className={`flex h-10 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 text-foreground ${fieldErrors.book ? "border-destructive focus-visible:ring-destructive/30" : "border-input focus-visible:ring-ring"}`}
                >
                  <option value="" className="bg-background text-foreground">
                    {t("tutorClass.newClass.selectBook")}
                  </option>
                  {books.map((book) => (
                    <option key={book.bookId} value={book.bookId} className="bg-background text-foreground">
                      {book.series?.name} - {book.title}
                    </option>
                  ))}
                </select>
                {fieldErrors.book && (
                  <p className="text-xs text-destructive font-semibold">{fieldErrors.book}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {t("tutorClass.newClass.schedule")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("tutorClass.newClass.quickTemplates")}</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKLY_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="px-3 h-8 rounded-full text-xs font-semibold border border-border bg-muted text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("tutorClass.newClass.days")}</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {CLASS_DAYS.map((day) => {
                    const active = selectedDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => { toggleDay(day.value); clearFieldError("schedule"); }}
                        title={`${t("tutorClass.newClass.dayTitlePrefix")}${day.full}`}
                        className={`
                          w-10 h-10 rounded-full text-sm font-semibold transition-all border select-none
                          ${active
                            ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                            : "bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                          }
                        `}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.schedule ? (
                  <p className="text-xs text-destructive font-semibold">{fieldErrors.schedule}</p>
                ) : (
                  <p className={`text-xs text-muted-foreground transition-opacity ${selectedDays.length === 0 ? "opacity-100" : "opacity-0"}`}>
                    {t("tutorClass.newClass.selectAtLeastOneDay")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {t("tutorClass.newClass.time")}
                </Label>
                <div className="flex items-center gap-2">
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {CLASS_TIME_OPTIONS.map((time) => (
                      <option key={time} value={time} className="bg-background">
                        {time}
                      </option>
                    ))}
                  </select>
                  <span className="text-muted-foreground text-sm shrink-0">
                    {t("tutorClass.newClass.until")}
                  </span>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {getEndTimeOptions(startTime).map((time) => (
                      <option key={time} value={time} className="bg-background">
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("tutorClass.newClass.totalHoursLabel")}</span>
                  <span className={`font-bold ${overLimit ? "text-destructive" : "text-foreground"}`}>
                    {totalHours} / {MAX_CLASS_HOURS} {t("tutorClass.newClass.hoursUnit")}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${overLimit ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${hoursPct}%` }}
                  />
                </div>
                {overLimit ? (
                  <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {t("tutorClass.newClass.hoursOverLimit")}
                  </p>
                ) : (!form.startsAt || !form.endsAt) ? (
                  <p className="text-[11px] text-muted-foreground/70">{t("tutorClass.newClass.hoursNeedDates")}</p>
                ) : null}
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 min-h-[52px]">
                {form.schedule ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {t("tutorClass.newClass.previewLabel")}
                    </p>
                    <p className="text-sm font-medium text-foreground">{form.schedule}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic">
                    {t("tutorClass.newClass.previewEmpty")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {t("tutorClass.newClass.classDates")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="starts-at">{t("tutorClass.newClass.startsAt")}</Label>
                  <Input
                    id="starts-at"
                    type="date"
                    value={form.startsAt}
                    min={today}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value, endsAt: form.endsAt && form.endsAt < e.target.value ? "" : form.endsAt })}
                    className="text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ends-at">{t("tutorClass.newClass.endsAt")}</Label>
                  <Input
                    id="ends-at"
                    type="date"
                    value={form.endsAt}
                    min={form.startsAt || undefined}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    className="text-foreground"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("tutorClass.newClass.datesHelp")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                {t("tutorClass.newClass.meetingUrlTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label htmlFor="meeting-url">{t("tutorClass.newClass.meetingUrlProviderLabel")}</Label>
                <Input
                  id="meeting-url"
                  type="url"
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={form.meetingUrl}
                  onChange={(e) =>
                    setForm({ ...form, meetingUrl: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("tutorClass.newClass.meetingUrlHelp")}
                </p>
              </div>

              <div className="mt-4 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 flex flex-col gap-2">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  {t("tutorClass.newClass.quickCreate")}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px] gap-1.5 bg-background hover:bg-muted"
                    onClick={() => window.open("https://meet.google.com/new", "_blank")}
                  >
                    Google Meet
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px] gap-1.5 bg-background hover:bg-muted"
                    onClick={() => window.open("https://zoom.us/start/videoconference", "_blank")}
                  >
                    Zoom
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 p-4 lg:p-0 bg-background/80 backdrop-blur-md border-t border-border lg:border-none lg:static lg:bg-transparent lg:mt-8 z-40">
          {errorText && (
            <p className="text-destructive text-sm font-medium mb-3 text-center lg:text-left">
              {errorText}
            </p>
          )}
          <Button
            id="btn-submit-create-class"
            type="submit"
            size="lg"
            className="w-full lg:w-auto lg:px-8 font-semibold shadow-md"
            disabled={loading || overLimit}
          >
            {loading ? t("tutorClass.newClass.creating") : t("tutorClass.newClass.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
