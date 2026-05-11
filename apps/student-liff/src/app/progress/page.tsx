"use client";

import { useState, useEffect } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import { studentApi } from "@/lib/api";
import { Flame, Clock, BookOpen, Target, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProgressStats {
  level: string;
  cefr: string;
  seriesColor: string;
  totalArticles: number;
  articlesRead: number;
  weekStreak: number;
  totalMinutes: number;
  nextMilestone: {
    at: number;
    reward: string;
  };
}

interface WeeklyActivity {
  day: string;
  minutes: number;
  active: boolean;
}

interface ProgressArticle {
  id: string;
  no: number;
  title: string;
  minutes: number;
  done: boolean;
}

interface ProgressData {
  stats: ProgressStats;
  weeklyActivity: WeeklyActivity[];
  articles: ProgressArticle[];
}

export default function ProgressPage() {
  const { isReady } = useLiff();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!isReady) return;
      
      try {
        setLoading(true);
        // Wait for session token
        let token = localStorage.getItem('student_session_token');
        let retries = 0;
        while (!token && retries < 10 && isMounted) {
          await new Promise(resolve => setTimeout(resolve, 500));
          token = localStorage.getItem('student_session_token');
          retries++;
        }

        if (!token) {
          throw new Error("Session unavailable");
        }

        const result = await studentApi.getStudentProgress() as ProgressData;
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [isReady]);

  if (!isReady || loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertCircle className="text-red-500 w-12 h-12" />
        <p className="text-slate-500">{error || "ไม่มีข้อมูล"}</p>
        <Button onClick={() => window.location.reload()}>ลองอีกครั้ง</Button>
      </div>
    );
  }

  const { stats, weeklyActivity, articles } = data;
  const progressPct = stats.totalArticles > 0 ? Math.round((stats.articlesRead / stats.totalArticles) * 100) : 0;
  const maxMin = Math.max(...(weeklyActivity.map((d) => d.minutes) || [0]), 1);

  return (
    <div>
      {/* Header */}
      <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)" }}>
        <h1 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>ความก้าวหน้า</h1>
        <span style={{ background: "var(--brand-50)", color: "var(--brand-700)", padding: "5px 12px", borderRadius: "var(--radius-full)", fontSize: "0.75rem", fontWeight: 700, border: "1px solid var(--brand-100)" }}>
          {stats.level} · {stats.cefr}
        </span>
      </div>

      <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Main progress card */}
        <div className="curved-bottom" style={{ background: `linear-gradient(135deg, ${stats.seriesColor} 0%, #037d36 100%)`, borderRadius: 24, overflow: "hidden", position: "relative" }}>
          <div aria-hidden style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ padding: "24px 20px" }}>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.75rem", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>ระดับปัจจุบัน</p>
            <h2 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, marginBottom: 20 }}>{stats.level}</h2>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8125rem" }}>{stats.articlesRead} จาก {stats.totalArticles} บท</span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.875rem" }}>{progressPct}%</span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.15)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #fff, #bbf7d0)", borderRadius: 20, transition: "width 0.6s ease", boxShadow: "0 0 10px rgba(255,255,255,0.3)" }} />
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.15)" }}>
              <Target size={16} style={{ color: "#fbbf24", flexShrink: 0 }} />
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.8125rem" }}>
                อีก <strong>{stats.nextMilestone.at - stats.articlesRead} บท</strong> รับ {stats.nextMilestone.reward}
              </span>
            </div>
          </div>
        </div>

        {/* Stat chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { Icon: Flame, label: "สตรีค", value: `${stats.weekStreak} สัปดาห์`, bgColor: "var(--accent-amber-light)", iconColor: "var(--accent-amber)" },
            { Icon: Clock, label: "เวลาเรียน", value: `${stats.totalMinutes} นาที`, bgColor: "var(--accent-blue-light)", iconColor: "var(--accent-blue)" },
            { Icon: BookOpen, label: "บทสำเร็จ", value: `${stats.articlesRead} บท`, bgColor: "var(--brand-50)", iconColor: "var(--brand-600)" },
          ].map((s) => (
            <div key={s.label} className="glass-card" style={{ textAlign: "center", padding: "16px 10px", background: s.bgColor, border: "1px solid var(--surface-border)" }}>
              <s.Icon size={20} style={{ color: s.iconColor, marginBottom: 6, marginInline: "auto" }} />
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Weekly chart */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>กิจกรรมสัปดาห์นี้</h3>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
            {weeklyActivity.map((d) => (
              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: "100%",
                  height: maxMin > 0 && d.minutes > 0 ? `${(d.minutes / maxMin) * 60}px` : "5px",
                  background: d.active ? `linear-gradient(180deg, ${stats.seriesColor}, #34d399)` : "var(--neutral-200)",
                  borderRadius: 6,
                  transition: "height 0.5s ease",
                  minHeight: 5,
                  boxShadow: d.active ? "0 2px 6px rgba(6,199,85,0.2)" : "none",
                }} />
                <span style={{ fontSize: "0.625rem", fontWeight: d.active ? 700 : 400, color: d.active ? "var(--brand-600)" : "var(--text-tertiary)" }}>
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Article list */}
        <div>
          <div className="section-header">
            <h3 className="section-title">บทเรียนทั้งหมด</h3>
            <span style={{ background: "var(--neutral-100)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: "var(--radius-full)", fontSize: "0.6875rem", fontWeight: 700 }}>
              {stats.articlesRead}/{stats.totalArticles}
            </span>
          </div>

          <div className="glass-card" style={{ overflow: "hidden" }}>
            {articles.map((art, idx) => (
              <div
                key={art.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                  borderTop: idx > 0 ? "1px solid var(--surface-border)" : "none",
                  opacity: art.done ? 1 : 0.55,
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: art.done ? "var(--brand-100)" : "var(--neutral-100)",
                  border: `2px solid ${art.done ? "var(--brand-400)" : "var(--neutral-200)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {art.done ? (
                    <CheckCircle2 size={14} style={{ color: "var(--brand-600)" }} />
                  ) : (
                    <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-tertiary)" }}>{art.no}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: art.done ? "var(--text-primary)" : "var(--text-tertiary)" }} className="text-ellipsis">
                    {art.title}
                  </div>
                  {art.done && (
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} /> {art.minutes} นาที
                    </div>
                  )}
                </div>
                {art.done ? (
                  <span style={{ background: "var(--brand-50)", color: "var(--brand-700)", fontSize: "0.625rem", fontWeight: 700, padding: "3px 8px", borderRadius: 8 }}>เสร็จ</span>
                ) : (
                  <Lock size={14} style={{ color: "var(--neutral-300)" }} />
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
