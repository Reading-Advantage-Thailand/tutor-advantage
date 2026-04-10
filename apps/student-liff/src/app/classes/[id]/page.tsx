import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `รายละเอียดคลาส ${id} — Tutor Advantage` };
}

export default async function ClassDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Mock data — wire to learning-service API
  const cls = {
    id,
    name: "Origins 2 — กลุ่มวันเสาร์",
    series: "Origins",
    cefr: "A1",
    level: 2,
    seriesColor: "#06c755",
    status: "open" as const,
    enrolled: 4,
    capacity: 6,
    price: 2800,
    tutor: {
      name: "อ.นภา สุขใส",
      initials: "นภ",
      bio: "ประสบการณ์สอนภาษาอังกฤษ 8 ปี เชี่ยวชาญระดับ A1–B1 ผ่านการรับรองจาก TED-Ed",
      rating: 4.9,
      students: 32,
    },
    schedule: [
      { day: "เสาร์", time: "10:00–11:30", location: "Online (LINE)" },
    ],
    nextSession: "เสาร์ที่ 12 เม.ย. 2026",
    totalHours: 25,
    articles: [
      { id: "art-1", no: 1, title: "Hello, World!", done: false },
      { id: "art-2", no: 2, title: "My Family", done: false },
      { id: "art-3", no: 3, title: "At the Market", done: false },
    ],
    highlights: [
      "ระบบบทเรียน 15 ขั้นตอนที่ผ่านการพิสูจน์แล้ว",
      "ติวเตอร์คุณภาพ สอน 25 ชั่วโมงต่อคอร์ส",
      "เรียนเพิ่มเติมผ่านแอปได้ตลอดเวลา",
      "รายงานผลการเรียนรู้ให้ผู้ปกครอง",
    ],
  };

  const fillPct = Math.round((cls.enrolled / cls.capacity) * 100);
  const seatsLeft = cls.capacity - cls.enrolled;

  return (
    <div className="page-shell">
      {/* Top bar */}
      <div className="top-bar">
        <Link
          href="/classes"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: "var(--neutral-100)",
            color: "var(--neutral-700)",
            textDecoration: "none",
            flexShrink: 0,
          }}
          aria-label="กลับ"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--neutral-900)", flex: 1 }}>
          รายละเอียดคลาส
        </h1>
        <button
          id="btn-share-class"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: "var(--neutral-100)",
            border: "none",
            cursor: "pointer",
            color: "var(--neutral-600)",
          }}
          aria-label="แชร์"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>

      {/* Hero banner */}
      <div
        style={{
          background: `linear-gradient(135deg, ${cls.seriesColor} 0%, #047d36 100%)`,
          padding: "28px 20px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />

        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <span
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              borderRadius: "var(--radius-full)",
              padding: "4px 12px",
              fontSize: "0.75rem",
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.35)",
            }}
          >
            {cls.cefr} · Level {cls.level}
          </span>
          <span
            style={{
              background: seatsLeft <= 2 ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.15)",
              color: "#fff",
              borderRadius: "var(--radius-full)",
              padding: "4px 12px",
              fontSize: "0.75rem",
              fontWeight: 700,
              border: `1px solid ${seatsLeft <= 2 ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.3)"}`,
            }}
          >
            {seatsLeft <= 2 ? `⚡ เหลือ ${seatsLeft} ที่` : `${seatsLeft} ที่ว่าง`}
          </span>
        </div>

        <h2
          style={{
            color: "#fff",
            fontSize: "1.25rem",
            fontWeight: 800,
            marginBottom: 6,
            lineHeight: 1.3,
          }}
        >
          {cls.name}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.875rem" }}>
          {cls.series} · {cls.totalHours} ชั่วโมง / คอร์ส
        </p>
      </div>

      {/* Scrollable content */}
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20, paddingBottom: 100 }}>

        {/* Tutor card */}
        <div className="card card-padded">
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
            <div
              className="avatar-initials avatar-lg"
              style={{
                background: `linear-gradient(135deg, ${cls.seriesColor}, ${cls.seriesColor}99)`,
                fontSize: "1rem",
              }}
            >
              {cls.tutor.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--neutral-900)" }}>
                {cls.tutor.name}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
                  ⭐ {cls.tutor.rating}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
                  👤 {cls.tutor.students} นักเรียน
                </span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--neutral-600)", lineHeight: 1.7 }}>
            {cls.tutor.bio}
          </p>
        </div>

        {/* Schedule */}
        <div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--neutral-900)", marginBottom: 10 }}>
            ตารางเรียน
          </h3>
          {cls.schedule.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                background: "#fff",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-xs)",
                border: "1.5px solid var(--neutral-200)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-md)",
                  background: "var(--brand-50)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                  flexShrink: 0,
                }}
              >
                📅
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--neutral-900)" }}>
                  ทุกวัน{s.day} · {s.time}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", marginTop: 2 }}>
                  {s.location} · คาบถัดไป: {cls.nextSession}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Capacity */}
        <div className="card card-padded">
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--neutral-900)", marginBottom: 12 }}>
            ที่นั่ง
          </h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.875rem", color: "var(--neutral-600)" }}>
              {cls.enrolled} จาก {cls.capacity} คน
            </span>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                color: seatsLeft <= 2 ? "var(--accent-red)" : "var(--brand-600)",
              }}
            >
              เหลือ {seatsLeft} ที่
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${fillPct}%`,
                background: seatsLeft <= 2
                  ? "linear-gradient(90deg, var(--accent-red), #f87171)"
                  : undefined,
              }}
            />
          </div>
        </div>

        {/* Highlights */}
        <div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--neutral-900)", marginBottom: 10 }}>
            สิ่งที่คุณจะได้รับ
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cls.highlights.map((h, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 14px",
                  background: "#fff",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--brand-100)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--brand-600)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <span style={{ fontSize: "0.875rem", color: "var(--neutral-700)", lineHeight: 1.6 }}>
                  {h}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Article preview */}
        <div>
          <div className="section-header">
            <h3 className="section-title">ตัวอย่างบทเรียน</h3>
            <span className="badge badge-neutral">{cls.articles.length} จาก 14 บท</span>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            {cls.articles.map((art, idx) => (
              <div
                key={art.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 16px",
                  borderTop: idx > 0 ? "1px solid var(--neutral-100)" : "none",
                  opacity: 0.7,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--neutral-100)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--neutral-500)",
                    flexShrink: 0,
                  }}
                >
                  {art.no}
                </div>
                <span style={{ fontSize: "0.875rem", color: "var(--neutral-700)", flex: 1 }}>
                  {art.title}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
            ))}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--neutral-100)",
                textAlign: "center",
                fontSize: "0.8125rem",
                color: "var(--neutral-400)",
              }}
            >
              + อีก 11 บทเรียน (ปลดล็อกหลังชำระเงิน)
            </div>
          </div>
        </div>
      </div>

      {/* Sticky CTA footer */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "var(--max-mobile)",
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(16px)",
          borderTop: "1px solid var(--neutral-200)",
          padding: "14px 16px 28px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          zIndex: 100,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--neutral-900)" }}>
            ฿{cls.price.toLocaleString()}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--neutral-400)" }}>
            จ่ายครั้งเดียว ·{" "}
            <span style={{ color: "var(--brand-600)", fontWeight: 600 }}>PromptPay / บัตร</span>
          </div>
        </div>
        <Link
          href={`/payment?classId=${cls.id}`}
          id="btn-enroll-class"
          className="btn btn-primary btn-lg"
          style={{ borderRadius: "var(--radius-full)", flexShrink: 0 }}
        >
          สมัครเรียน
        </Link>
      </div>
    </div>
  );
}
