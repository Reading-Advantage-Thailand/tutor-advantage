"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, BookOpen, Calendar, Link2, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createClass, getBooks } from "../actions";

const DAYS = [
  { label: "จ", full: "จันทร์", value: "MON" },
  { label: "อ", full: "อังคาร", value: "TUE" },
  { label: "พ", full: "พุธ", value: "WED" },
  { label: "พฤ", full: "พฤหัสบดี", value: "THU" },
  { label: "ศ", full: "ศุกร์", value: "FRI" },
  { label: "ส", full: "เสาร์", value: "SAT" },
  { label: "อา", full: "อาทิตย์", value: "SUN" },
];

const TIME_OPTIONS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
  "19:00", "20:00", "21:00", "22:00",
];

function buildScheduleString(days: string[], startTime: string, endTime: string): string {
  if (!days.length || !startTime || !endTime) return "";
  const dayLabels = days.map(v => DAYS.find(d => d.value === v)?.full).join(", ");
  return `ทุกวัน${dayLabels} ${startTime}–${endTime} น.`;
}

export default function NewClassPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [form, setForm] = useState({
    name: "",
    book: "",
    schedule: "",
    meetingUrl: "",
  });
  const [books, setBooks] = useState<any[]>([]);

  // Schedule builder state
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("21:00");

  // Sync schedule string whenever selections change
  useEffect(() => {
    const s = buildScheduleString(selectedDays, startTime, endTime);
    setForm(prev => ({ ...prev, schedule: s }));
  }, [selectedDays, startTime, endTime]);

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
    setSelectedDays(prev =>
      prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.schedule) {
      setErrorText("กรุณาเลือกวันและเวลาเรียน");
      return;
    }
    setLoading(true);
    setErrorText("");
    try {
      await createClass(form);
      router.push("/dashboard/classes");
      router.refresh();
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setErrorText(error.message || "เกิดข้อผิดพลาดในการสร้างคลาส");
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
            สร้างคลาสเรียนใหม่
          </h1>
          <p className="text-sm text-muted-foreground">
            กรอกรายละเอียดคลาสเพื่อเริ่มรับสมัครนักเรียน
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 flex-1">
          {/* Class Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                ข้อมูลคลาส
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="class-name">ชื่อคลาส</Label>
                <Input
                  id="class-name"
                  placeholder="เช่น Origins 1 - กลุ่ม A"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="book">หนังสือเรียน</Label>
                <select
                  id="book"
                  value={form.book}
                  onChange={(e) => setForm({ ...form, book: e.target.value })}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="" className="bg-background text-foreground">เลือกหนังสือ...</option>
                  {books.map((b) => (
                    <option key={b.bookId} value={b.bookId} className="bg-background text-foreground">
                      {b.series?.name} - {b.title}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Builder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                ตารางเรียน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Day selector */}
              <div className="space-y-2">
                <Label>วันที่เรียน</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS.map((day) => {
                    const active = selectedDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        title={`วัน${day.full}`}
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
                <p className={`text-xs text-muted-foreground transition-opacity ${selectedDays.length === 0 ? "opacity-100" : "opacity-0"}`}>
                  เลือกอย่างน้อย 1 วัน
                </p>
              </div>

              {/* Time selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  เวลาเรียน
                </Label>
                <div className="flex items-center gap-2">
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t} className="bg-background">{t}</option>
                    ))}
                  </select>
                  <span className="text-muted-foreground text-sm shrink-0">ถึง</span>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {TIME_OPTIONS.filter(t => t > startTime).map(t => (
                      <option key={t} value={t} className="bg-background">{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview - always reserve space to prevent layout shift */}
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 min-h-[52px]">
                {form.schedule ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-0.5">ตารางที่จะแสดงให้นักเรียนเห็น</p>
                    <p className="text-sm font-medium text-foreground">{form.schedule}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic">เลือกวันและเวลาเพื่อดูตัวอย่าง...</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Meeting URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                ลิงก์ห้องเรียนออนไลน์
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label htmlFor="meeting-url">Google Meet / Zoom URL</Label>
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
                  ลิงก์นี้จะแสดงให้นักเรียนกดเข้าเรียนได้เฉพาะนักเรียนที่ชำระเงินแล้วเท่านั้น
                </p>
              </div>

              {/* Quick Create Links */}
              <div className="mt-4 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 flex flex-col gap-2">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  ยังไม่ได้สร้างห้องเรียนออนไลน์ใช่ไหม? สร้างเลย:
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

        {/* Submit Button */}
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
            disabled={loading}
          >
            {loading ? "กำลังสร้างคลาส..." : "สร้างคลาสและรับ Referral Link"}
          </Button>
        </div>
      </form>
    </div>
  );
}
