"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { ChevronLeft, Play, CheckCircle2, Lock, Video, FileText } from "lucide-react";
import { studentApi } from "@/lib/api";
import { useLiff } from "@/components/providers/LiffProvider";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface StudyClass {
  name?: string;
}

export default function StudyPage({ params }: PageProps) {
  const { id } = use(params);
  const { isReady } = useLiff();
  const [cls, setCls] = useState<StudyClass | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isReady && id) {
      studentApi.getClassDetails(id)
        .then(data => {
          setCls(data.class);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch study data:", err);
          setLoading(false);
        });
    }
  }, [isReady, id]);

  if (loading || !cls) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  // Mock lessons for demonstration
  const lessons = [
    { id: "L1", title: "Introduction & Basic Vocab", type: "video", duration: "15:20", completed: true },
    { id: "L2", title: "Daily Conversations", type: "article", duration: "10 mins", completed: true },
    { id: "L3", title: "Common Grammar Mistakes", type: "video", duration: "22:45", completed: false },
    { id: "L4", title: "Final Quiz - Unit 1", type: "quiz", duration: "15 mins", completed: false },
  ];

  return (
    <div className="page-shell" style={{ background: "var(--surface-bg)", minHeight: "100dvh", paddingBottom: 40 }}>
      {/* Top Header */}
      <div className="top-bar" style={{ background: "var(--surface-card)", borderBottom: "1px solid var(--surface-border)" }}>
        <Link href="/dashboard" style={{ background: "var(--neutral-100)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", textDecoration: "none" }}>
          <ChevronLeft size={18} />
        </Link>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 8px" }}>
          {cls.name}
        </h1>
      </div>

      {/* Main Content */}
      <div style={{ padding: "16px" }}>
        
        {/* Video Player Placeholder */}
        <div className="glass-card" style={{ height: 200, borderRadius: 24, background: "#000", position: "relative", overflow: "hidden", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80')`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.8 }} />
          <div style={{ zIndex: 1, width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "1px solid rgba(255,255,255,0.3)" }}>
            <Play size={28} style={{ color: "#fff", fill: "#fff", marginLeft: 4 }} />
          </div>
          <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 1 }}>
            <div style={{ color: "#fff", fontSize: "0.875rem", fontWeight: 700 }}>บทที่ 3: Common Grammar Mistakes</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>22:45 นาที</div>
          </div>
        </div>

        {/* Course Info */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)" }}>บทเรียนทั้งหมด</h2>
            <span style={{ fontSize: "0.8125rem", color: "var(--brand-600)", fontWeight: 700 }}>สำเร็จ 2/14</span>
          </div>
          
          <div className="progress-bar" style={{ height: 6, background: "var(--neutral-100)" }}>
            <div className="progress-bar-fill" style={{ width: "15%" }} />
          </div>
        </div>

        {/* Lesson List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lessons.map((lesson, idx) => (
            <div 
              key={lesson.id} 
              className="glass-card" 
              style={{ 
                padding: "16px", 
                display: "flex", 
                alignItems: "center", 
                gap: 14, 
                opacity: lesson.completed ? 1 : 0.8,
                border: !lesson.completed && idx === 2 ? "1px solid var(--brand-500)" : "1px solid var(--surface-border)"
              }}
            >
              <div style={{ 
                width: 44, height: 44, borderRadius: 14, 
                background: lesson.completed ? "var(--brand-50)" : "var(--neutral-100)", 
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 
              }}>
                {lesson.type === "video" ? <Video size={20} style={{ color: lesson.completed ? "var(--brand-600)" : "var(--text-tertiary)" }} /> : <FileText size={20} style={{ color: lesson.completed ? "var(--brand-600)" : "var(--text-tertiary)" }} />}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>{lesson.title}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 2 }}>{lesson.duration}</div>
              </div>

              {lesson.completed ? (
                <CheckCircle2 size={20} style={{ color: "var(--brand-500)" }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: idx === 2 ? "var(--brand-500)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                   {idx === 2 ? <Play size={14} style={{ color: "#fff", fill: "#fff", marginLeft: 2 }} /> : <Lock size={16} style={{ color: "var(--neutral-300)" }} />}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick Review */}
        <div className="glass-card" style={{ marginTop: 24, padding: "18px", background: "linear-gradient(135deg, var(--brand-500), var(--brand-600))", border: "none" }}>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>สถิติการเรียน</div>
          <div style={{ color: "#fff", fontSize: "1.125rem", fontWeight: 800, marginTop: 4, lineHeight: 1.3 }}>คุณทำคะแนนได้ดีมาก!<br />บทถัดไปพร้อมให้เรียนแล้ว</div>
          <button className="btn" style={{ background: "#fff", color: "var(--brand-600)", fontWeight: 700, borderRadius: 14, marginTop: 16, width: "100%", height: 44 }}>
            ทำแบบทดสอบ Unit 1
          </button>
        </div>

      </div>
    </div>
  );
}
