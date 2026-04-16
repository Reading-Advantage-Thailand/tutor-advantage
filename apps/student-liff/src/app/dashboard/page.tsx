"use client";

import { useLiff } from "@/components/providers/LiffProvider";

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
          {student.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.avatar} alt={student.name} className="avatar avatar-lg" style={{ border: "2.5px solid rgba(255,255,255,0.5)", objectFit: "cover" }} />
          ) : (
            <div
              className="avatar-initials avatar-lg"
              style={{ border: "2.5px solid rgba(255,255,255,0.5)", fontSize: "1.125rem" }}
            >
              {student.initials}
            </div>
          )}
        </div>

        {/* Level chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.2)",
              borderRadius: "var(--radius-full)",
              padding: "5px 12px",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#fff",
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            <span style={{ color: "#fff", fontSize: "0.8125rem", fontWeight: 600 }}>
              {student.level} · {student.cefr}
            </span>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(255,255,255,0.15)",
              borderRadius: "var(--radius-full)",
              padding: "5px 12px",
            }}
          >
            <span style={{ fontSize: "0.875rem" }}>🔥</span>
            <span style={{ color: "#fff", fontSize: "0.8125rem", fontWeight: 600 }}>
              {enrollment.weekStreak} สัปดาห์ติด
            </span>
          </div>
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

          <div
            className="card card-padded"
            style={{ background: "linear-gradient(135deg, #fff 0%, #f0fdf6 100%)", border: "1.5px solid var(--brand-100)" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    color: "var(--neutral-900)",
                    marginBottom: 4,
                  }}
                  className="line-clamp-2"
                >
                  {enrollment.className}
                </h3>
                <div style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {enrollment.tutorName}
                </div>
              </div>
            </div>

            {/* Next session */}
            <div
              style={{
                background: "var(--brand-50)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
                border: "1px solid var(--brand-100)",
              }}
            >
              <span style={{ fontSize: "1rem" }}>📅</span>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--brand-700)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  คาบถัดไป
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--neutral-700)", fontWeight: 500, marginTop: 1 }}>
                  {enrollment.nextSession}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--neutral-600)", fontWeight: 500 }}>
                  ความก้าวหน้า
                </span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--brand-700)" }}>
                  {enrollment.articlesRead}/{enrollment.totalArticles} บท
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--neutral-400)", marginTop: 5, textAlign: "right" }}>
                {progressPct}% สำเร็จ
              </div>
            </div>
          </div>
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
              <a
                key={item.id}
                id={item.id}
                href={item.href}
                className="card card-hover"
                style={{
                  padding: "16px 14px",
                  background: item.color,
                  border: `1.5px solid ${item.border}`,
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--neutral-900)" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginTop: 2 }}>
                  {item.sub}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Recent articles */}
        <section>
          <div className="section-header">
            <h2 className="section-title">บทความล่าสุด</h2>
            <a href="/classes" className="section-action">ดูทั้งหมด</a>
          </div>

          <div className="card stagger" style={{ overflow: "hidden" }}>
            {recentArticles.map((article, idx) => (
              <a
                key={article.id}
                href={`/student/read/${article.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  textDecoration: "none",
                  borderTop: idx > 0 ? "1px solid var(--neutral-100)" : "none",
                  transition: "background var(--duration-fast)",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "var(--radius-md)",
                    background: "var(--brand-50)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: "1.125rem",
                  }}
                >
                  📄
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--neutral-900)",
                    }}
                    className="text-ellipsis"
                  >
                    {article.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-400)", marginTop: 2 }}>
                    {article.level} · {article.readAt}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
            ))}
          </div>
        </section>

        {/* Referral link */}
        <section>
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              borderRadius: "var(--radius-xl)",
              padding: "20px",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: "1.25rem" }}>🔗</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>แชร์ให้เพื่อน</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: 1 }}>
                  เพื่อนสมัครผ่านลิงก์ของคุณ
                </div>
              </div>
            </div>
            <button
              id="btn-copy-referral"
              className="btn btn-sm"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(255,255,255,0.2)",
                width: "100%",
                fontSize: "0.8125rem",
              }}
            >
              คัดลอกลิงก์สมัครเรียน
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
