import Link from "next/link";
import { Star, Users, Calendar, CheckCircle2, Lock, Share2, ChevronLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `รายละเอียดคลาส ${id} — Tutor Advantage` };
}

export default async function ClassDetailPage({ params }: PageProps) {
  const { id } = await params;

  const cls = {
    id, name: "Origins 2 — กลุ่มวันเสาร์", series: "Origins", cefr: "A1", level: 2,
    seriesColor: "#06c755", status: "open" as const, enrolled: 4, capacity: 6, price: 2800,
    tutor: { name: "อ.นภา สุขใส", initials: "นภ", bio: "ประสบการณ์สอนภาษาอังกฤษ 8 ปี เชี่ยวชาญระดับ A1–B1 ผ่านการรับรองจาก TED-Ed", rating: 4.9, students: 32 },
    schedule: [{ day: "เสาร์", time: "10:00–11:30", location: "Online (LINE)" }],
    nextSession: "เสาร์ที่ 12 เม.ย. 2026", totalHours: 25,
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

  const seatsLeft = cls.capacity - cls.enrolled;
  const fillPct = Math.round((cls.enrolled / cls.capacity) * 100);

  return (
    <div className="page-shell">
      {/* Top bar */}
      <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)" }}>
        <Link href="/classes" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 12, background: "var(--neutral-100)", color: "var(--text-secondary)", textDecoration: "none", flexShrink: 0 }} aria-label="กลับ">
          <ChevronLeft size={18} />
        </Link>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>รายละเอียดคลาส</h1>
        <button id="btn-share-class" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 12, background: "var(--neutral-100)", border: "none", cursor: "pointer", color: "var(--text-secondary)" }} aria-label="แชร์">
          <Share2 size={16} />
        </button>
      </div>

      {/* Hero banner */}
      <div className="curved-bottom" style={{ background: `linear-gradient(135deg, ${cls.seriesColor} 0%, #037d36 100%)`, padding: "28px 20px 36px", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ background: "rgba(255,255,255,0.18)", color: "#fff", borderRadius: "var(--radius-full)", padding: "5px 14px", fontSize: "0.75rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(4px)" }}>
            {cls.cefr} · Level {cls.level}
          </span>
          <span style={{ background: seatsLeft <= 2 ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.12)", color: "#fff", borderRadius: "var(--radius-full)", padding: "5px 14px", fontSize: "0.75rem", fontWeight: 700, border: `1px solid ${seatsLeft <= 2 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.2)"}` }}>
            {seatsLeft <= 2 ? `⚡ เหลือ ${seatsLeft} ที่` : `${seatsLeft} ที่ว่าง`}
          </span>
        </div>

        <h2 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>{cls.name}</h2>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.875rem" }}>{cls.series} · {cls.totalHours} ชั่วโมง / คอร์ส</p>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 110, marginTop: -8 }}>

        {/* Tutor */}
        <div className="glass-card" style={{ padding: "18px" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${cls.seriesColor}, ${cls.seriesColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1rem", fontWeight: 800, flexShrink: 0 }}>
              {cls.tutor.initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>{cls.tutor.name}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
                  <Star size={12} style={{ color: "#f59e0b", fill: "#f59e0b" }} /> {cls.tutor.rating}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
                  <Users size={12} /> {cls.tutor.students} นักเรียน
                </span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>{cls.tutor.bio}</p>
        </div>

        {/* Schedule */}
        <div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>ตารางเรียน</h3>
          {cls.schedule.map((s, i) => (
            <div key={i} className="glass-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--brand-100)" }}>
                <Calendar size={20} style={{ color: "var(--brand-600)" }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>ทุกวัน{s.day} · {s.time}</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: 2 }}>{s.location} · คาบถัดไป: {cls.nextSession}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Capacity */}
        <div className="glass-card" style={{ padding: "18px" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>ที่นั่ง</h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{cls.enrolled} จาก {cls.capacity} คน</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: seatsLeft <= 2 ? "var(--accent-red)" : "var(--brand-600)" }}>เหลือ {seatsLeft} ที่</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${fillPct}%`, background: seatsLeft <= 2 ? "linear-gradient(90deg, var(--accent-red), #f87171)" : undefined }} />
          </div>
        </div>

        {/* Highlights */}
        <div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>สิ่งที่คุณจะได้รับ</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cls.highlights.map((h, i) => (
              <div key={i} className="glass-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                <CheckCircle2 size={18} style={{ color: "var(--brand-500)", flexShrink: 0 }} />
                <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{h}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Article preview */}
        <div>
          <div className="section-header">
            <h3 className="section-title">ตัวอย่างบทเรียน</h3>
            <span style={{ background: "var(--neutral-100)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: "var(--radius-full)", fontSize: "0.6875rem", fontWeight: 700 }}>{cls.articles.length} จาก 14 บท</span>
          </div>
          <div className="glass-card" style={{ overflow: "hidden" }}>
            {cls.articles.map((art, idx) => (
              <div key={art.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: idx > 0 ? "1px solid var(--surface-border)" : "none", opacity: 0.65 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--neutral-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", flexShrink: 0 }}>{art.no}</div>
                <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", flex: 1 }}>{art.title}</span>
                <Lock size={14} style={{ color: "var(--neutral-300)" }} />
              </div>
            ))}
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--surface-border)", textAlign: "center", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
              + อีก 11 บทเรียน (ปลดล็อกหลังชำระเงิน)
            </div>
          </div>
        </div>
      </div>

      {/* Sticky CTA footer */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "var(--max-mobile)", background: "var(--nav-glass-bg)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", borderTop: "1px solid var(--surface-border)", padding: "14px 16px 28px", display: "flex", gap: 12, alignItems: "center", zIndex: 100 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>฿{cls.price.toLocaleString()}</div>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>จ่ายครั้งเดียว · <span style={{ color: "var(--brand-600)", fontWeight: 600 }}>PromptPay / บัตร</span></div>
        </div>
        <Link href={`/payment?classId=${cls.id}`} id="btn-enroll-class" className="btn btn-primary btn-lg shine-effect" style={{ borderRadius: 18, flexShrink: 0, padding: "14px 28px" }}>
          สมัครเรียน
        </Link>
      </div>
    </div>
  );
}
