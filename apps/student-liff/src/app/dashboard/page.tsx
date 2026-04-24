"use client";

import { useLiff } from "@/components/providers/LiffProvider";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function DashboardPage() {
  const { profile, isReady } = useLiff();

  // Mock data for Enrollment – replace with real API calls later
  const student = {
    name: profile?.displayName || "กำลังโหลด...",
    avatar: profile?.pictureUrl || null,
    initials: profile?.displayName?.charAt(0) || "TA",
    level: "Origins 2",
    cefr: "A1",
    seriesColor: "#06c755",
  };

  const enrollment = {
    className: "Origins 2 — กลุ่มวันเสาร์",
    tutorName: "อ.นภา สุขใส",
    status: "active" as const,
    nextSession: "เสาร์ที่ 12 เม.ย. 2026 · 10:00–11:30",
    articlesRead: 7,
    totalArticles: 14,
    weekStreak: 3,
  };

  const recentArticles = [
    { id: "art-1", title: "The Magic Garden", level: "A1", readAt: "เมื่อวาน" },
    { id: "art-2", title: "My First Day of School", level: "A1", readAt: "2 วันที่แล้ว" },
    { id: "art-3", title: "Animals in the Zoo", level: "A1", readAt: "4 วันที่แล้ว" },
  ];

  const progressPct = Math.round(
    (enrollment.articlesRead / enrollment.totalArticles) * 100
  );

  if (!isReady) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <header
        style={{
          background: "linear-gradient(135deg, #06c755 0%, #047d36 100%)",
          padding: "20px 20px 24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          {/* Greeting */}
          <div>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8125rem", fontWeight: 500 }}>
              สวัสดีตอนเช้า 👋
            </p>
            <h1 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 700, marginTop: 2 }}>
              {student.name}
            </h1>
          </div>

          {/* Avatar */}
          <Avatar className="w-14 h-14 border-2 border-white/50">
            {student.avatar && <AvatarImage src={student.avatar} alt={student.name} className="object-cover" />}
            <AvatarFallback className="bg-white/20 text-white text-lg font-bold">
              {student.initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Level chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge variant="outline" className="text-white border-white/30 bg-white/20 px-3 py-1 font-semibold rounded-full border">
            <span className="w-2 h-2 rounded-full bg-white mr-2" />
            {student.level} · {student.cefr}
          </Badge>
          <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/20 px-3 py-1 font-semibold rounded-full">
            🔥 {enrollment.weekStreak} สัปดาห์ติด
          </Badge>
        </div>
      </header>

      {/* ── Content ── */}
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Enrollment card */}
        <section>
          <div className="section-header">
            <h2 className="section-title">คลาสของฉัน</h2>
            <span className={`status-chip status-${enrollment.status}`}>
              {enrollment.status === "active" ? "กำลังเรียน" : "รอดำเนินการ"}
            </span>
          </div>

          <Card className="bg-gradient-to-br from-white to-green-50 border-green-100 shadow-sm mt-3">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-bold text-slate-900 mb-1 line-clamp-2">
                    {enrollment.className}
                  </h3>
                  <div className="text-[13px] text-slate-500 flex items-center gap-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    {enrollment.tutorName}
                  </div>
                </div>
              </div>

              {/* Next session */}
              <div className="bg-green-50 rounded-md p-3 flex items-center gap-2.5 mb-4 border border-green-100">
                <span className="text-base">📅</span>
                <div>
                  <div className="text-[11px] text-green-700 font-bold uppercase tracking-wider">
                    คาบถัดไป
                  </div>
                  <div className="text-[13px] text-slate-700 font-medium mt-0.5">
                    {enrollment.nextSession}
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[13px] text-slate-600 font-medium">
                    ความก้าวหน้า
                  </span>
                  <span className="text-[13px] font-bold text-green-700">
                    {enrollment.articlesRead}/{enrollment.totalArticles} บท
                  </span>
                </div>
                <Progress value={progressPct} className="h-2 bg-green-100" />
                <div className="text-[12px] text-slate-400 mt-1.5 text-right">
                  {progressPct}% สำเร็จ
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="section-title" style={{ marginBottom: 12 }}>เมนูด่วน</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              {
                id: "quick-read",
                href: "/classes",
                icon: "📖",
                label: "อ่านบทความ",
                sub: "เริ่มบทเรียนวันนี้",
                color: "var(--brand-50)",
                border: "var(--brand-200)",
              },
              {
                id: "quick-chat",
                href: "#",
                icon: "💬",
                label: "แชทติวเตอร์",
                sub: "ถาม-ตอบตรงๆ",
                color: "var(--accent-blue-light)",
                border: "#bfdbfe",
              },
              {
                id: "quick-schedule",
                href: "#",
                icon: "🗓️",
                label: "ตารางเรียน",
                sub: "ดูคาบทั้งหมด",
                color: "var(--accent-purple-light)",
                border: "#ddd6fe",
              },
              {
                id: "quick-payment",
                href: "/payment",
                icon: "💳",
                label: "ชำระเงิน",
                sub: "PromptPay / บัตร",
                color: "var(--accent-amber-light)",
                border: "#fde68a",
              },
            ].map((item) => (
              <Card key={item.id} className="overflow-hidden border-none shadow-sm transition-transform active:scale-[0.98]">
                <Link
                  id={item.id}
                  href={item.href}
                  className="block p-4"
                  style={{ background: item.color, border: `1.5px solid ${item.border}`, borderRadius: "var(--radius-xl)" }}
                >
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="text-[14px] font-bold text-slate-900">{item.label}</div>
                  <div className="text-[12px] text-slate-500 mt-0.5">{item.sub}</div>
                </Link>
              </Card>
            ))}
          </div>
        </section>

        {/* Recent articles */}
        <section>
          <div className="section-header">
            <h2 className="section-title">บทความล่าสุด</h2>
            <Link href="/classes" className="section-action">ดูทั้งหมด</Link>
          </div>

          <Card className="overflow-hidden shadow-sm mt-3 border-none">
            {recentArticles.map((article, idx) => (
              <div key={article.id}>
                {idx > 0 && <Separator />}
                <Link
                  href={`/student/read/${article.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-md bg-green-50 flex items-center justify-center shrink-0 text-lg">
                    📄
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-slate-900 truncate">
                      {article.title}
                    </div>
                    <div className="text-[12px] text-slate-400 mt-0.5">
                      {article.level} · {article.readAt}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              </div>
            ))}
          </Card>
        </section>

        {/* Referral link */}
        <section>
          <Card className="bg-slate-900 text-white border-none shadow-md overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-xl">🔗</span>
                <div>
                  <div className="font-bold text-[15px]">แชร์ให้เพื่อน</div>
                  <div className="text-[12px] text-slate-400 mt-0.5">
                    เพื่อนสมัครผ่านลิงก์ของคุณ
                  </div>
                </div>
              </div>
              <Button
                id="btn-copy-referral"
                variant="outline"
                className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white h-10 text-[13px] border"
              >
                คัดลอกลิงก์สมัครเรียน
              </Button>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}
