import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Video,
  Users,
  ChevronRight,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { ReferralLink, LessonPlan } from "./client-components";
import { notFound } from "next/navigation";

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

async function getClassData(classId: string, token: string) {
  const res = await fetch(`http://localhost:3002/v1/classes/${classId}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
}

// In Next.js 15, `params` is a Promise
export default async function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const response = await getClassData(classId, token);
  if (!response || !response.class) {
    return notFound();
  }

  const cls = response.class;

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
          <span className="text-foreground">{cls.name}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {cls.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {cls.book} · {cls.schedule}
            </p>
          </div>
          <span
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              cls.status === "open"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            }`}
          >
            {cls.status === "open" ? "รับสมัครอยู่" : "เต็มแล้ว"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        
        {/* Left Column (Info, Meeting, Link, Students) */}
        <div className="lg:col-span-5 space-y-4 lg:space-y-6">
          {/* Join Meeting */}
          {cls.meetingUrl && (
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
                        {cls.meetingUrl}
                      </p>
                    </div>
                  </div>
                  <a
                    href={cls.meetingUrl}
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

          <ReferralLink referralLink={cls.referralLink} />

          {/* Students */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                นักเรียน ({cls.students}/{cls.maxStudents} คน)
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border/50">
              {cls.enrolledStudents.length === 0 && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  ยังไม่มีนักเรียนสมัคร
                </div>
              )}
              {cls.enrolledStudents.map((s: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                      {s.name[0] || "?"}
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
          <LessonPlan lessonPlan={lessonPlan} />
        </div>
      </div>
    </div>
  );
}
