"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { Star, Users, Calendar, CheckCircle2, Lock, Share2, ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { studentApi } from "@/lib/api";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClassDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { isReady } = useLiff();
  const [cls, setCls] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && id) {
      studentApi.getClassDetails(id)
        .then(data => {
          setCls(data.class);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch class details:", err);
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isReady, id]);

  if (!isReady || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-12 gap-2 bg-slate-50">
        <Loader2 className="animate-spin text-brand-500 w-10 h-10" />
        <p className="text-slate-400 font-medium">กำลังโหลดข้อมูลคลาส...</p>
      </div>
    );
  }

  if (error || !cls) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertCircle className="text-red-500 w-12 h-12" />
        <h2 className="text-xl font-bold text-slate-800">ไม่พบข้อมูลคลาส</h2>
        <p className="text-slate-500">{error || "กรุณาลองใหม่อีกครั้ง"}</p>
        <Link href="/classes">
          <Button variant="outline">กลับไปหน้าคลาสเรียน</Button>
        </Link>
      </div>
    );
  }

  const seriesColor = cls.seriesColor || "#06c755";
  const seatsLeft = cls.maxStudents - cls.students;
  const fillPct = Math.round((cls.students / cls.maxStudents) * 100);
  const price = cls.price || 2800;

  const highlights = [
    "ระบบบทเรียน 15 ขั้นตอนที่ผ่านการพิสูจน์แล้ว",
    "ติวเตอร์คุณภาพ สอน 25 ชั่วโมงต่อคอร์ส",
    "เรียนเพิ่มเติมผ่านแอปได้ตลอดเวลา",
    "รายงานผลการเรียนรู้ให้ผู้ปกครอง",
  ];

  const articles = [
    { id: "art-1", no: 1, title: "Lesson Overview", done: false },
  ];

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
      <div className="curved-bottom" style={{ background: `linear-gradient(135deg, ${seriesColor} 0%, #037d36 100%)`, padding: "28px 20px 36px", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ background: "rgba(255,255,255,0.18)", color: "#fff", borderRadius: "var(--radius-full)", padding: "5px 14px", fontSize: "0.75rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(4px)" }}>
            {cls.cefr || "A1"} · Level {cls.level || 1}
          </span>
          <span style={{ background: seatsLeft <= 2 ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.12)", color: "#fff", borderRadius: "var(--radius-full)", padding: "5px 14px", fontSize: "0.75rem", fontWeight: 700, border: `1px solid ${seatsLeft <= 2 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.2)"}` }}>
            {seatsLeft <= 2 ? `⚡ เหลือ ${seatsLeft} ที่` : `${seatsLeft} ที่ว่าง`}
          </span>
        </div>

        <h2 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>{cls.name}</h2>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.875rem" }}>{cls.book} · {cls.totalHours || 25} ชั่วโมง / คอร์ส</p>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 110, marginTop: -8 }}>

        {/* Tutor */}
        <div className="glass-card" style={{ padding: "18px" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${seriesColor}, ${seriesColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1rem", fontWeight: 800, flexShrink: 0 }}>
              {cls.tutor?.initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>{cls.tutor.name}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
                  <Star size={12} style={{ color: "#f59e0b", fill: "#f59e0b" }} /> {cls.tutor?.rating || 5.0}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
                  <Users size={12} /> {cls.tutor?.students || 0} นักเรียน
                </span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>{cls.tutor.bio}</p>
        </div>

        {/* Schedule */}
        <div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>ตารางเรียน</h3>
          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--brand-100)" }}>
              <Calendar size={20} style={{ color: "var(--brand-600)" }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>{cls.schedule}</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: 2 }}>คาบถัดไป: {cls.nextSession || "TBA"}</div>
            </div>
          </div>
        </div>

        {/* Capacity */}
        <div className="glass-card" style={{ padding: "18px" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>ที่นั่ง</h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{cls.students} จาก {cls.maxStudents} คน</span>
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
            {highlights.map((h, i) => (
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
            <span style={{ background: "var(--neutral-100)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: "var(--radius-full)", fontSize: "0.6875rem", fontWeight: 700 }}>1 จาก 14 บท</span>
          </div>
          <div className="glass-card" style={{ overflow: "hidden" }}>
            {articles.map((art, idx) => (
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

      {/* Premium Sticky CTA footer */}
      <div style={{ 
        position: "fixed", 
        bottom: 0, 
        left: "50%", 
        transform: "translateX(-50%)", 
        width: "100%", 
        maxWidth: "var(--max-mobile)", 
        background: "var(--nav-glass-bg)", 
        backdropFilter: "blur(24px) saturate(180%)", 
        WebkitBackdropFilter: "blur(24px) saturate(180%)", 
        borderTop: "1px solid var(--surface-border)", 
        padding: "16px 20px 34px", 
        display: "flex", 
        gap: 16, 
        alignItems: "center", 
        zIndex: 100,
        boxShadow: "0 -10px 30px rgba(0,0,0,0.1)"
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>ราคาสุทธิ</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>฿{(cls.price || 2800).toLocaleString()}</span>
          </div>
        </div>
        {cls.isEnrolled ? (
          <div 
            className="btn" 
            style={{ 
              borderRadius: 20, 
              flexShrink: 0, 
              padding: "0 24px",
              height: 56,
              fontSize: "0.9375rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--neutral-100)",
              color: "var(--text-tertiary)",
              border: "1px solid var(--surface-border)",
              cursor: "default"
            }}
          >
            ลงทะเบียนแล้ว
          </div>
        ) : (
          <Link 
            href={`/payment?classId=${cls.id}`} 
            id="btn-enroll-class" 
            className="btn btn-primary shine-effect" 
            style={{ 
              borderRadius: 20, 
              flexShrink: 0, 
              padding: "0 32px",
              height: 56,
              fontSize: "1.0625rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 20px rgba(6,199,85,0.3)"
            }}
          >
            สมัครเรียนตอนนี้
          </Link>
        )}
      </div>
    </div>
  );
}
