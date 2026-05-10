"use client";

import React, { useState, useEffect } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BookOpen, MessageCircle, Calendar, CreditCard, ChevronRight, Copy, Flame, AlertCircle } from "lucide-react";
import { studentApi } from "@/lib/api";

export default function DashboardPage() {
  const { profile, isReady } = useLiff();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && profile) {
      const fetchData = async () => {
        try {
          // Wait up to 5 seconds for session token to appear
          let token = localStorage.getItem('student_session_token');
          let retries = 0;
          while (!token && retries < 10) {
            console.log("[Dashboard] Waiting for backend session token...");
            await new Promise(resolve => setTimeout(resolve, 500));
            token = localStorage.getItem('student_session_token');
            retries++;
          }

          if (!token) {
            throw new Error("ไม่สามารถสร้างเซสชันกับเซิร์ฟเวอร์ได้ กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง");
          }

          const [data, hist] = await Promise.all([
            studentApi.getDashboard(),
            studentApi.getLessonHistory().catch(() => ({ history: [] }))
          ]);
          setDashboardData(data);
          setHistoryData(hist.history || []);
          setLoading(false);
        } catch (err: any) {
          console.error("Failed to fetch dashboard:", err);
          setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [isReady, profile]);

  const student = {
    name: profile?.displayName || "กำลังโหลด...",
    avatar: profile?.pictureUrl || null,
    initials: profile?.displayName?.charAt(0) || "TA",
    level: "Origins 2", // Still placeholder, could be from user profile
    cefr: "A1",
  };

  const enrollment = dashboardData?.recentClasses?.[0] || {
    name: "ยังไม่มีคลาสเรียน",
    tutorName: "-",
    status: "none",
    nextSession: "-",
    progress: 0,
  };

  const recentArticles = [
    { id: "art-1", title: "The Magic Garden", level: "A1", readAt: "เมื่อวาน" },
  ];

  const progressPct = enrollment.progress || 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "สวัสดีตอนเช้า ☀️";
    if (hour < 17) return "สวัสดีตอนบ่าย 🌤️";
    return "สวัสดีตอนเย็น 🌙";
  };

  if (!isReady || loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertCircle className="text-red-500 w-12 h-12" />
        <h2 className="text-xl font-bold text-slate-800">เกิดข้อผิดพลาดในการโหลดข้อมูล</h2>
        <p className="text-slate-500">{error}</p>
        <Button onClick={() => window.location.reload()}>ลองอีกครั้ง</Button>
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
            {dashboardData?.weekStreak || 0} สัปดาห์ต่อเนื่อง
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="page-content" style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20, marginTop: -8 }}>

        {/* Enrollment card */}
        <section>
          <div className="section-header">
            <h2 className="section-title">คลาสของฉัน</h2>
            {dashboardData?.activeEnrollments > 0 && (
              <span className={`status-chip status-active`}>
                กำลังเรียน {dashboardData.activeEnrollments} คลาส
              </span>
            )}
          </div>

          <Link 
            href={enrollment.id ? `/lesson/${enrollment.id}` : "/classes"}
            className="block no-underline active:scale-[0.98] transition-transform"
          >
            <Card className="glass-card overflow-hidden" style={{ border: enrollment.isLive ? "2px solid var(--brand-500)" : "1px solid var(--surface-border)", marginTop: 8 }}>
              <CardContent style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    {enrollment.isLive && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "4px 8px", borderRadius: 6, fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 1.5s infinite" }} />
                        Live Now
                      </div>
                    )}
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }} className="line-clamp-2">
                      {enrollment.name}
                    </h3>
                  </div>
                  <ChevronRight size={18} style={{ color: "var(--neutral-400)", marginLeft: 8 }} />
                </div>
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
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--brand-700)" }}>{progressPct}%</span>
                  </div>
                  <Progress value={progressPct} className="h-2 bg-green-100" />
                </div>
              </CardContent>
            </Card>
          </Link>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px" }}>
              {dashboardData?.recentClasses?.map((cls: any) => (
                <Link 
                  key={cls.id} 
                  href={`/classes/${cls.id}`}
                  className="glass-card clickable-effect" 
                  style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--brand-100)" }}>
                    <BookOpen size={20} style={{ color: "var(--brand-600)" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>{cls.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 2 }}>{cls.book} · {cls.progress}% สำเร็จ</div>
                  </div>
                  <ChevronRight size={18} style={{ color: "var(--neutral-300)" }} />
                </Link>
              ))}
            </div>
          </Card>
        </section>

        {/* ── Lesson History Section ── */}
        <section>
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h2 className="section-title">ประวัติการเข้าเรียน</h2>
            {historyData.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>ล่าสุด {historyData.length} ครั้ง</span>
            )}
          </div>

          {historyData.length === 0 ? (
            <Card className="glass-card overflow-hidden" style={{ marginTop: 4, padding: "32px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📜</div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>ยังไม่มีประวัติการเรียนในระบบ</div>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              {historyData.map((hist: any) => (
                <Link 
                  key={hist.sessionId}
                  href={`/lesson/history/${hist.sessionId}`}
                  className="glass-card clickable-effect"
                  style={{ 
                    textDecoration: "none", 
                    padding: "14px 16px", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 14 
                  }}
                >
                  <div 
                    style={{ 
                      width: 46, 
                      height: 46, 
                      borderRadius: 12, 
                      display: "flex", 
                      flexDirection: "column", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      flexShrink: 0, 
                      fontWeight: 800,
                      background: hist.rank === 1 ? 'rgba(245, 158, 11, 0.15)' : hist.rank === 2 ? 'rgba(148, 163, 184, 0.15)' : 'var(--neutral-100)',
                      color: hist.rank === 1 ? '#d97706' : hist.rank === 2 ? '#475569' : 'var(--text-secondary)'
                    }}
                  >
                    <span style={{ fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1 }}>RANK</span>
                    <span style={{ fontSize: "1.125rem", lineHeight: 1, marginTop: 2 }}>{hist.rank}</span>
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {hist.articleTitle}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                      <span>ครู {hist.tutorName}</span>
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor", opacity: 0.5 }} />
                      <span>{new Date(hist.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0, background: "rgba(5, 150, 105, 0.1)", border: "1px solid rgba(5, 150, 105, 0.15)", color: "#059669", padding: "4px 10px", borderRadius: 8 }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 800, lineHeight: 1 }}>{hist.score}</div>
                    <div style={{ fontSize: "0.5625rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.8, marginTop: 1 }}>pts</div>
                  </div>
                  
                  <ChevronRight size={16} style={{ color: "var(--neutral-300)" }} />
                </Link>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
