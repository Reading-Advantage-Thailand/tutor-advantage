"use client";

import { useLiff } from "@/components/providers/LiffProvider";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BookOpen, MessageCircle, Calendar, CreditCard, ChevronRight, Copy, Flame } from "lucide-react";

export default function DashboardPage() {
  const { profile, isReady } = useLiff();

  const student = {
    name: profile?.displayName || "กำลังโหลด...",
    avatar: profile?.pictureUrl || null,
    initials: profile?.displayName?.charAt(0) || "TA",
    level: "Origins 2",
    cefr: "A1",
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

  const progressPct = Math.round((enrollment.articlesRead / enrollment.totalArticles) * 100);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "สวัสดีตอนเช้า ☀️";
    if (hour < 17) return "สวัสดีตอนบ่าย 🌤️";
    return "สวัสดีตอนเย็น 🌙";
  };

  if (!isReady) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface-bg)", minHeight: "100dvh" }}>

      {/* ── Header with curved bottom ── */}
      <header
        className="curved-bottom"
        style={{
          background: "linear-gradient(135deg, #06c755 0%, #049a42 50%, #037d36 100%)",
          padding: "20px 20px 28px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div aria-hidden style={{ position: "absolute", bottom: 10, left: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8125rem", fontWeight: 500 }}>
              {getGreeting()}
            </p>
            <h1 style={{ color: "#fff", fontSize: "1.375rem", fontWeight: 800, marginTop: 2, letterSpacing: "-0.01em" }}>
              {student.name}
            </h1>
          </div>
          <Avatar className="w-14 h-14 border-[3px] border-white/40 shadow-lg">
            {student.avatar && <AvatarImage src={student.avatar} alt={student.name} className="object-cover" />}
            <AvatarFallback className="bg-white/20 text-white text-lg font-bold">
              {student.initials}
            </AvatarFallback>
          </Avatar>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", padding: "4px 12px", borderRadius: 14, fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", backdropFilter: "blur(4px)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", marginRight: 6 }} />
            {student.level} · {student.cefr}
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "4px 12px", borderRadius: 14, fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center" }}>
            <Flame size={14} style={{ marginRight: 6, color: "#fbbf24" }} />
            {enrollment.weekStreak} สัปดาห์ต่อเนื่อง
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="page-content" style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20, marginTop: -8 }}>

        {/* Enrollment card */}
        <section>
          <div className="section-header">
            <h2 className="section-title">คลาสของฉัน</h2>
            <span className={`status-chip status-${enrollment.status}`}>
              {enrollment.status === "active" ? "กำลังเรียน" : "รอดำเนินการ"}
            </span>
          </div>

          <Card className="glass-card overflow-hidden" style={{ border: "1px solid var(--surface-border)", marginTop: 8 }}>
            <CardContent style={{ padding: "20px" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }} className="line-clamp-2">
                {enrollment.className}
              </h3>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {enrollment.tutorName}
              </div>

              {/* Next session */}
              <div style={{ background: "var(--brand-50)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16, border: "1px solid var(--brand-100)" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Calendar size={18} style={{ color: "var(--brand-600)" }} />
                </div>
                <div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--brand-600)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>คาบถัดไป</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 500, marginTop: 1 }}>{enrollment.nextSession}</div>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontWeight: 500 }}>ความก้าวหน้า</span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--brand-700)" }}>{enrollment.articlesRead}/{enrollment.totalArticles} บท</span>
                </div>
                <Progress value={progressPct} className="h-2 bg-green-100" />
                <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 6, textAlign: "right" }}>{progressPct}% สำเร็จ</div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Referral card */}
        <section>
          <Card className="glass-card overflow-hidden" style={{ borderRadius: 20 }}>
            <CardContent style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-100)" }}>
                  <Copy size={16} style={{ color: "var(--brand-600)" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>แชร์ให้เพื่อน</div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: 1 }}>เพื่อนสมัครผ่านลิงก์ของคุณ</div>
                </div>
              </div>
              <Button id="btn-copy-referral" variant="outline" className="w-full h-10 text-[13px] border rounded-xl" style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)", background: "var(--surface-bg)" }}>
                คัดลอกลิงก์สมัครเรียน
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="section-title" style={{ marginBottom: 12 }}>เมนูด่วน</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { id: "quick-read", href: "/classes", Icon: BookOpen, label: "อ่านบทความ", sub: "เริ่มบทเรียนวันนี้", bgColor: "var(--brand-50)", iconBg: "var(--brand-100)", iconColor: "var(--brand-600)" },
              { id: "quick-chat", href: "#", Icon: MessageCircle, label: "แชทติวเตอร์", sub: "ถาม-ตอบตรงๆ", bgColor: "var(--accent-blue-light)", iconBg: "rgba(59, 130, 246, 0.15)", iconColor: "var(--accent-blue)" },
              { id: "quick-schedule", href: "#", Icon: Calendar, label: "ตารางเรียน", sub: "ดูคาบทั้งหมด", bgColor: "var(--accent-purple-light)", iconBg: "rgba(139, 92, 246, 0.15)", iconColor: "var(--accent-purple)" },
              { id: "quick-payment", href: "/payment", Icon: CreditCard, label: "ชำระเงิน", sub: "PromptPay / บัตร", bgColor: "var(--accent-amber-light)", iconBg: "rgba(245, 158, 11, 0.15)", iconColor: "var(--accent-amber)" },
            ].map((item) => (
              <Link
                key={item.id}
                id={item.id}
                href={item.href}
                className="block active:scale-[0.97]"
                style={{ background: item.bgColor, border: "1px solid var(--surface-border)", borderRadius: 18, padding: "16px 14px", textDecoration: "none", transition: "all 0.2s ease", minHeight: 100, position: "relative", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <item.Icon size={18} style={{ color: item.iconColor }} />
                </div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>{item.label}</div>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: 2 }}>{item.sub}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent articles */}
        <section>
          <div className="section-header">
            <h2 className="section-title">บทความล่าสุด</h2>
            <Link href="/classes" className="section-action" style={{ display: "flex", alignItems: "center", gap: 2 }}>
              ดูทั้งหมด <ChevronRight size={14} />
            </Link>
          </div>

          <Card className="glass-card overflow-hidden" style={{ marginTop: 8 }}>
            {recentArticles.map((article, idx) => (
              <div key={article.id}>
                {idx > 0 && <Separator style={{ background: "var(--surface-border)" }} />}
                <Link
                  href={`/student/read/${article.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textDecoration: "none" }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <BookOpen size={18} style={{ color: "var(--brand-500)" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }} className="text-ellipsis">{article.title}</div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 2 }}>{article.level} · {article.readAt}</div>
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--neutral-400)", flexShrink: 0 }} />
                </Link>
              </div>
            ))}
          </Card>
        </section>

      </div>
    </div>
  );
}
