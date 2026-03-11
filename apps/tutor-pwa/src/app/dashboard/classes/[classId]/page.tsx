"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Video,
  Copy,
  CheckCircle2,
  Users,
  BookOpen,
  ChevronRight,
  ExternalLink,
  QrCode,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

const mockClass = {
  id: "cls-1",
  name: "Origins 1 - กลุ่ม A",
  book: "Origins 1",
  status: "open",
  students: 3,
  maxStudents: 5,
  schedule: "ทุกวันจันทร์ 19:00–21:00",
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  referralLink: "https://liff.line.me/9999999-XXXXXXXX?classId=cls-1",
  enrolledStudents: [
    { name: "น้องอาย", enrolled: "3 มี.ค. 2026", paid: true },
    { name: "น้องโอ", enrolled: "5 มี.ค. 2026", paid: true },
    { name: "น้องมิ้ว", enrolled: "7 มี.ค. 2026", paid: true },
  ],
};

const lessonPlan = [
  "สวัสดีนักเรียน และเช็คชื่อ (Roll call)",
  "ทบทวนคำศัพท์จากบทก่อนหน้า (5 นาที)",
  "แนะนำหัวข้อบทเรียนวันนี้",
  "อ่านบทความด้วยกัน (Read-aloud)",
  "อธิบายคำศัพท์ใหม่ในบทความ",
  "ตอบคำถามความเข้าใจ (Comprehension Questions)",
  "ฝึกออกเสียงคำศัพท์สำคัญ",
  "แบ่งกลุ่มอภิปราย (Pair/Group Discussion)",
  "นำเสนอความคิดเห็นต่อกลุ่มใหญ่",
  "ทำแบบฝึกหัด Grammar ในแอป",
  "ตรวจคำตอบและอธิบายข้อผิดพลาด",
  "เกม/กิจกรรมสนุก (Gamified Activity)",
  "สรุปสิ่งที่เรียนรู้วันนี้",
  "มอบหมายการบ้าน (Homework)",
  "ถามคำถามและปิดคลาส",
];

export default function ClassDetailPage() {
  const [copied, setCopied] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);

  const handleCopy = () => {
    navigator.clipboard.writeText(mockClass.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleStep = (i: number) =>
    setCheckedSteps((prev) =>
      prev.includes(i) ? prev.filter((s) => s !== i) : [...prev, i],
    );

  const progress = Math.round((checkedSteps.length / lessonPlan.length) * 100);

  return (
    <div className="w-full max-w-5xl space-y-5 pb-24 lg:pb-0">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Link
            href="/dashboard/classes"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> คลาสเรียน
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{mockClass.name}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {mockClass.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {mockClass.book} · {mockClass.schedule}
            </p>
          </div>
          <span
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              mockClass.status === "open"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            }`}
          >
            {mockClass.status === "open" ? "รับสมัครอยู่" : "เต็มแล้ว"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        
        {/* Left Column (Info, Meeting, Link, Students) */}
        <div className="lg:col-span-5 space-y-4 lg:space-y-6">
          {/* Join Meeting */}
          {mockClass.meetingUrl && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <Video className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        ห้องเรียนออนไลน์
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {mockClass.meetingUrl}
                      </p>
                    </div>
                  </div>
                  <a
                    href={mockClass.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto"
                  >
                    <Button
                      id="btn-join-meeting"
                      size="sm"
                      className="w-full sm:w-auto gap-2 shrink-0"
                    >
                      เข้าห้องเรียน <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

      {/* Referral link */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            ลิงก์เชิญนักเรียน (Referral Link)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={mockClass.referralLink}
              className="flex-1 h-9 rounded-lg border border-input bg-muted px-3 text-xs text-foreground font-mono"
            />
            <button
              onClick={handleCopy}
              id="btn-copy-referral"
              className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-input hover:bg-muted transition-colors"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            แชร์ลิงก์นี้ให้ผู้ปกครองสมัครและชำระเงินผ่าน LINE ได้ทันที
          </p>
        </CardContent>
      </Card>

          {/* Students */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                นักเรียน ({mockClass.students}/{mockClass.maxStudents} คน)
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border/50">
              {mockClass.enrolledStudents.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {s.name[1]}
                    </div>
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground hidden sm:inline-block">
                      {s.enrolled}
                    </span>
                    {s.paid && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium whitespace-nowrap">
                        ชำระแล้ว
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Lesson Plan) */}
        <div className="lg:col-span-7">
          {/* 15-Step Lesson Plan */}
          <Card className="border-border/60 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  แผนการสอน 15 ขั้นตอน
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {checkedSteps.length}/{lessonPlan.length} เสร็จแล้ว
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-1.5 mt-3">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1">
                {lessonPlan.map((step, i) => {
                  const done = checkedSteps.includes(i);
                  return (
                    <li
                      key={i}
                      id={`lesson-step-${i + 1}`}
                      onClick={() => toggleStep(i)}
                      className={`flex items-start gap-3 rounded-lg p-2.5 cursor-pointer transition-all ${
                        done ? "opacity-60" : "hover:bg-muted/60"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-all ${
                          done
                            ? "bg-primary text-primary-foreground"
                            : "border-2 border-border text-muted-foreground"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </div>
                      <span
                        className={`text-sm ${done ? "line-through text-muted-foreground" : "text-foreground"}`}
                      >
                        {step}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
