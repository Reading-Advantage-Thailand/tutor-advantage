"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, BookOpen, Calendar as CalendarIcon, Link2, Clock, ExternalLink, AlertTriangle, Ticket, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { createClass, getBooks, validateCoupon } from "../actions";
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
  parseLocalDate,
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
    couponCode: "",
  });

  const [couponChecking, setCouponChecking] = useState(false);
  const [couponHours, setCouponHours] = useState<number | null>(null);
  const [couponError, setCouponError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [books, setBooks] = useState<any[]>([]);
  const booksByProgram = useMemo(() => ({
    reading: books.filter((book) => !String(book.bookCode || "").startsWith("Primary ")),
    primary: books.filter((book) => String(book.bookCode || "").startsWith("Primary ")),
  }), [books]);
  const bookLabel = (book: any) =>
    String(book.bookCode || "").startsWith("Primary ")
      ? String(book.title || "").replace(/\s*\([A-C]\d\)$/i, "")
      : book.title;

  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [dateTimes, setDateTimes] = useState<Record<string, { start: string; end: string }>>({});

  const [genStart, setGenStart] = useState("");

  useEffect(() => {
    const start = new Date();
    setGenStart(format(start, 'yyyy-MM-dd'));
  }, []);

  // Helper to diff hours
  const diffHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    return minutes > 0 ? minutes / 60 : 0;
  };

  const handleGenerate = (tpl: typeof WEEKLY_TEMPLATES[0]) => {
    if (!genStart) return;
    const start = parseLocalDate(genStart);

    const newDates: Date[] = [];
    const nextTimes: Record<string, { start: string; end: string }> = {};
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);

    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    
    let accumulatedHours = 0;

    // Generate dates until we perfectly hit maxHours (e.g. 22 hours + freeHours)
    while (accumulatedHours < maxHours) {
      const dayName = dayNames[cur.getDay()];
      if (tpl.days.includes(dayName)) {
        const d = new Date(cur);
        newDates.push(d);
        
        const templateHours = diffHours(tpl.startTime, tpl.endTime);
        const hoursNeeded = maxHours - accumulatedHours;
        
        if (hoursNeeded >= templateHours) {
          nextTimes[format(d, 'yyyy-MM-dd')] = { start: tpl.startTime, end: tpl.endTime };
          accumulatedHours += templateHours;
        } else {
          // Adjust the end time for the final day to exactly reach maxHours
          const [sh, sm] = tpl.startTime.split(":").map(Number);
          const totalMinutes = (sh * 60 + sm) + (hoursNeeded * 60);
          const eh = Math.floor(totalMinutes / 60);
          const em = totalMinutes % 60;
          const adjustedEndTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
          
          nextTimes[format(d, 'yyyy-MM-dd')] = { start: tpl.startTime, end: adjustedEndTime };
          accumulatedHours += hoursNeeded;
        }
      }
      cur.setDate(cur.getDate() + 1);
    }

    setSelectedDates(newDates);
    setDateTimes(nextTimes);
    clearFieldError("schedule");
  };


  const totalHours = useMemo(() => {
    let sum = 0;
    selectedDates.forEach(d => {
      const key = format(d, 'yyyy-MM-dd');
      const times = dateTimes[key];
      if (times) sum += diffHours(times.start, times.end);
    });
    return Math.round(sum * 100) / 100;
  }, [selectedDates, dateTimes]);

  const scheduleDescription = useMemo(() => {
    if (selectedDates.length === 0) return "";
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    
    const firstDate = sorted[0];
    const lastDate = sorted[sorted.length - 1];
    
    const startStr = format(firstDate, 'd MMM yy', { locale: th });
    const endStr = format(lastDate, 'd MMM yy', { locale: th });
    
    if (sorted.length === 1) {
      const times = dateTimes[format(firstDate, 'yyyy-MM-dd')];
      return `${startStr} (${times?.start || ''}-${times?.end || ''})`;
    }
    
    return `${startStr} - ${endStr} (รวม ${sorted.length} วัน)`;
  }, [selectedDates, dateTimes]);

  useEffect(() => {
    setForm(prev => ({ ...prev, schedule: scheduleDescription }));
  }, [scheduleDescription]);

  const freeHours = couponHours ?? 0;
  const maxHours = MAX_CLASS_HOURS + freeHours;
  const overLimit = totalHours > maxHours;
  const hoursPct = Math.min(100, (totalHours / maxHours) * 100);

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



  const handleCheckCoupon = async () => {
    const code = form.couponCode.trim();
    if (!code) return;
    setCouponChecking(true);
    setCouponError("");
    setCouponHours(null);
    try {
      const result = await validateCoupon(code);
      setCouponHours(result.hours);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setCouponError(err.message || t("tutorClass.errors.coupon"));
    } finally {
      setCouponChecking(false);
    }
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
    if (!form.schedule) newErrors.schedule = "โปรดระบุวันและเวลาสอน (จำเป็น)";
    if (overLimit) newErrors.schedule = t("tutorClass.newClass.hoursOverLimit");
    setFieldErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      setErrorText("โปรดกรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }
    
    setLoading(true);
    setErrorText("");
    try {
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      const finalStartsAt = sortedDates.length > 0 ? format(sortedDates[0], 'yyyy-MM-dd') : "";
      const finalEndsAt = sortedDates.length > 0 ? format(sortedDates[sortedDates.length - 1], 'yyyy-MM-dd') : "";
      const scheduleData = sortedDates.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        return {
          date: dateStr,
          start: dateTimes[dateStr]?.start || "",
          end: dateTimes[dateStr]?.end || "",
        };
      });
      const payload = { ...form, scheduleData, startsAt: finalStartsAt, endsAt: finalEndsAt, totalHours };
      await createClass(payload);
      router.push("/dashboard/classes");
      router.refresh();
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setErrorText(error.message || t("tutorClass.newClass.createFailed"));
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl pb-24 lg:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
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

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {errorText && (
            <p className="text-destructive text-xs sm:text-sm font-medium">
              {errorText}
            </p>
          )}
          <Button
            id="btn-submit-create-class"
            type="submit"
            form="create-class-form"
            className="w-full sm:w-auto px-6 font-semibold shadow-md"
            disabled={loading || overLimit}
          >
            {loading ? t("tutorClass.newClass.creating") : t("tutorClass.newClass.submit")}
          </Button>
        </div>
      </div>

      <form id="create-class-form" onSubmit={handleSubmit} className="flex flex-col h-full pb-20 lg:pb-0">
        <div className="flex flex-col gap-4 lg:gap-6 flex-1">
          {/* Top Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
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
                    {booksByProgram.reading.length > 0 && (
                      <optgroup label="Reading Advantage">
                        {booksByProgram.reading.map((book) => (
                          <option key={book.bookId} value={book.bookId} className="bg-background text-foreground">
                            {bookLabel(book)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {booksByProgram.primary.length > 0 && (
                      <optgroup label="Primary Advantage">
                        {booksByProgram.primary.map((book) => (
                          <option key={book.bookId} value={book.bookId} className="bg-background text-foreground">
                            {bookLabel(book)}
                          </option>
                        ))}
                      </optgroup>
                    )}
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

          {/* Coupon Row */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                {t("tutorClass.newClass.couponTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-code">{t("tutorClass.newClass.couponLabel")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="coupon-code"
                    placeholder={t("tutorClass.newClass.couponPlaceholder")}
                    value={form.couponCode}
                    onChange={(e) => {
                      setForm({ ...form, couponCode: e.target.value });
                      setCouponHours(null);
                      setCouponError("");
                    }}
                    className="font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCheckCoupon}
                    disabled={couponChecking || !form.couponCode.trim()}
                    className="shrink-0"
                  >
                    {couponChecking ? t("tutorClass.newClass.couponChecking") : t("tutorClass.newClass.couponCheck")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("tutorClass.newClass.couponHelp")}
                </p>
                {couponHours !== null && (
                  <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("tutorClass.newClass.couponValid")}: {couponHours} {t("tutorClass.newClass.couponHoursUnit")}
                  </p>
                )}
                {couponError && (
                  <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {couponError}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bottom Row */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                วันและเวลาสอน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* Left Column: Calendar & Template */}
                <div className="space-y-4">
                  <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-3 mb-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">เพิ่มวันสอนแบบอัตโนมัติ (Template)</Label>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px]">เริ่มสอนตั้งแต่วันที่ (ระบบจะคำนวณวันให้จนครบ {maxHours} ชม.)</Label>
                        <Input type="date" value={genStart} onChange={e => setGenStart(e.target.value)} className="h-8 text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">คลิกเทมเพลตเพื่อเพิ่มลงปฏิทิน(ตัวเลือกสำเร็จรูป)</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {WEEKLY_TEMPLATES.map(tpl => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => handleGenerate(tpl)}
                            className="px-2.5 h-7 rounded-md text-[11px] font-semibold border border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all"
                          >
                            + {tpl.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setSelectedDates([]); setDateTimes({}); }}
                          className="px-2.5 h-7 rounded-md text-[11px] font-semibold border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all ml-auto"
                        >
                          ล้างทั้งหมด
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className={`text-sm font-bold ${fieldErrors.schedule ? 'text-destructive' : ''}`}>เลือกวันสอนบนปฏิทิน</Label>
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">
                        {selectedDates.length > 0 ? `เลือกแล้ว ${selectedDates.length} วัน` : "ยังไม่ได้เลือกวัน"}
                      </span>
                    </div>
                    {fieldErrors.schedule && (
                      <p className="text-xs text-destructive font-semibold">{fieldErrors.schedule}</p>
                    )}
                    <div className={`w-full flex justify-center p-2 sm:p-6 rounded-xl border bg-background shadow-sm overflow-x-auto ${fieldErrors.schedule ? 'border-destructive ring-1 ring-destructive/30' : ''}`}>
                      <Calendar
                        mode="multiple"
                        locale={th}
                        defaultMonth={selectedDates[0] || new Date()}
                        selected={selectedDates}
                        style={{ "--cell-size": "3rem" } as React.CSSProperties}
                        className="pointer-events-auto border-0 p-0 sm:[--cell-size:3.5rem]"
                        classNames={{
                          day: "text-base font-medium",
                          caption_label: "text-lg font-bold"
                        }}
                        onSelect={(dates) => {
                          const newDates = dates || [];
                          setSelectedDates(newDates);
                          setDateTimes(prev => {
                            const next = { ...prev };
                            newDates.forEach(d => {
                              const key = format(d, 'yyyy-MM-dd');
                              if (!next[key]) next[key] = { start: '19:00', end: '21:00' };
                            });
                            return next;
                          });
                          clearFieldError("schedule");
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Date List & Summary */}
                <div className="space-y-4 flex flex-col h-full min-h-[400px]">
                  {/* Total Hours Section (moved to top) */}
                  <div className="space-y-1.5 pb-4 border-b border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t("tutorClass.newClass.totalHoursLabel")}</span>
                      <span className={`font-bold ${overLimit ? "text-destructive" : "text-foreground"}`}>
                        {totalHours} / {maxHours} {t("tutorClass.newClass.hoursUnit")}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${overLimit ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${hoursPct}%` }}
                      />
                    </div>
                    {freeHours > 0 && (
                      <div className="flex flex-col gap-0.5 text-[11px] pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            {t("tutorClass.newClass.regularHoursLabel")}
                          </span>
                          <span className="font-semibold text-foreground tabular-nums">{MAX_CLASS_HOURS} {t("tutorClass.newClass.hoursUnit")}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {t("tutorClass.newClass.couponHoursLabel")}
                          </span>
                          <span className="font-semibold text-emerald-600 tabular-nums">{freeHours} {t("tutorClass.newClass.hoursUnit")}</span>
                        </div>
                      </div>
                    )}
                    {overLimit ? (
                      <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> {t("tutorClass.newClass.hoursOverLimit")}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    {selectedDates.length > 0 ? (
                      <div className="space-y-3 h-full flex flex-col">
                        <Label>ตั้งเวลาสอนแต่ละวัน</Label>
                        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                          {[...selectedDates].sort((a,b) => a.getTime() - b.getTime()).map(d => {
                            const key = format(d, 'yyyy-MM-dd');
                            const times = dateTimes[key] || { start: '19:00', end: '21:00' };
                            return (
                              <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                                <span className="text-sm font-semibold w-16 shrink-0">{format(d, 'd MMM', { locale: th })}</span>
                                <select
                                  value={times.start}
                                  onChange={(e) => setDateTimes(prev => ({ ...prev, [key]: { ...prev[key], start: e.target.value } }))}
                                  className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                  {CLASS_TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                                </select>
                                <span className="text-muted-foreground text-xs">-</span>
                                <select
                                  value={times.end}
                                  onChange={(e) => setDateTimes(prev => ({ ...prev, [key]: { ...prev[key], end: e.target.value } }))}
                                  className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                  {getEndTimeOptions(times.start).map((time) => <option key={time} value={time}>{time}</option>)}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                        <CalendarIcon className="h-10 w-10 opacity-20 mb-2" />
                        <p className="text-sm">โปรดเลือกวันที่ต้องการสอนบนปฏิทิน</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 shrink-0 mt-auto">
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
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

      </form>
    </div>
  );
}
