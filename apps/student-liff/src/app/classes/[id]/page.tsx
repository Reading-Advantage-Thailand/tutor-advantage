"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { Star, Users, Calendar, CheckCircle2, Lock, Share2, ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { studentApi } from "@/lib/api";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Tutor {
  name: string;
  initials: string;
  bio?: string;
  rating?: number;
  students?: number;
}

interface ClassArticlePreview {
  id: string;
  no: number;
  title: string;
  type?: string | null;
  genre?: string | null;
}

interface ClassDetail {
  id: string;
  name: string;
  status: string;
  seriesColor?: string;
  maxStudents: number;
  students: number;
  tutor: Tutor;
  cefr: string;
  level: number;
  nextSession: string;
  price: number;
  book: string;
  bookCode?: string | null;
  seriesName?: string | null;
  seriesTagline?: string | null;
  articleCount?: number;
  independentHours?: number;
  totalHours?: number;
  schedule: string;
  highlights?: string[];
  articles?: ClassArticlePreview[];
  isEnrolled?: boolean;
  enrollmentStatus?: string | null;
}

interface TutorReview {
  id: string;
  rating: number;
  comment?: string | null;
}

export default function ClassDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { isReady } = useLiff();
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [review, setReview] = useState<TutorReview | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewEditing, setReviewEditing] = useState(false);
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
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        });
    }
  }, [isReady, id]);

  const canReview = Boolean(cls?.isEnrolled && cls.status === "closed");

  useEffect(() => {
    if (!isReady || !id || !canReview) return;

    setReviewLoading(true);
    studentApi.getClassReview(id)
      .then(data => {
        const existingReview = data.review || null;
        setReview(existingReview);
        setReviewRating(existingReview?.rating || 0);
        setReviewComment(existingReview?.comment || "");
      })
      .catch(() => {
        setReview(null);
      })
      .finally(() => setReviewLoading(false));
  }, [isReady, id, canReview]);

  const handleSubmitReview = async () => {
    if (!reviewRating) {
      toast.error("กรุณาเลือกจำนวนดาวก่อนส่งรีวิว");
      return;
    }

    setReviewSubmitting(true);
    try {
      const data = await studentApi.submitClassReview(id, {
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReview(data.review);
      setReviewEditing(false);
      toast.success("บันทึกรีวิวเรียบร้อยแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกรีวิวไม่สำเร็จ");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!isReady || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-6 py-[max(24px,var(--safe-top))]">
        <div className="w-full max-w-[280px] rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <Loader2 className="animate-spin text-primary w-10 h-10 mx-auto mb-4" />
          <p className="text-foreground text-sm font-bold">{t("classes.detail.loadingTitle")}</p>
          <p className="text-muted-foreground text-xs font-medium mt-1">{t("classes.detail.loadingSubtitle")}</p>
        </div>
      </div>
    );
  }

  if (error || !cls) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertCircle className="text-red-500 w-12 h-12" />
        <h2 className="text-xl font-bold text-slate-800">{t("classes.detail.notFound")}</h2>
        <p className="text-slate-500">{error || t("classes.detail.retry")}</p>
        <Link href="/classes">
          <Button variant="outline">{t("classes.detail.backToClasses")}</Button>
        </Link>
      </div>
    );
  }

  const seriesColor = cls.seriesColor || "#06c755";
  const seatsLeft = cls.maxStudents - cls.students;
  const fillPct = Math.round((cls.students / cls.maxStudents) * 100);

  const fallbackHighlights = [
    t("classes.detail.highlightSystem"),
    cls.totalHours ? `${t("classes.detail.liveHoursPrefix")} ${cls.totalHours} ${t("classes.detail.hourUnit")}` : t("classes.detail.liveBySchedule"),
    t("classes.detail.appAccess"),
    t("classes.detail.parentReport"),
  ];

  const fallbackArticles: ClassArticlePreview[] = [];
  const highlights = cls.highlights?.length ? cls.highlights : fallbackHighlights;
  const articles = cls.articles?.length ? cls.articles : fallbackArticles;
  const articleCount = cls.articleCount || articles.length;
  const tutorBio =
    cls.tutor.bio ||
    `${t("classes.detail.tutorBioPrefix")} ${cls.tutor.name} ${t("classes.detail.tutorBioWithContent")} ${cls.book}${cls.seriesName ? ` ${t("classes.detail.tutorBioSeriesPrefix")} ${cls.seriesName}` : ""}`;

  return (
    <div className="page-shell">
      {/* Top bar */}
      <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)" }}>
        <Link href="/classes" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 12, background: "var(--neutral-100)", color: "var(--text-secondary)", textDecoration: "none", flexShrink: 0 }} aria-label={t("classes.detail.backAria")}>
          <ChevronLeft size={18} />
        </Link>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>{t("classes.detail.title")}</h1>
        <button id="btn-share-class" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 12, background: "var(--neutral-100)", border: "none", cursor: "pointer", color: "var(--text-secondary)" }} aria-label={t("classes.detail.shareAria")}>
          <Share2 size={16} />
        </button>
      </div>

      {/* Hero banner */}
      <div className="curved-bottom" style={{ background: `linear-gradient(135deg, ${seriesColor} 0%, #037d36 100%)`, padding: "28px 20px 36px", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ background: "rgba(255,255,255,0.18)", color: "#fff", borderRadius: "var(--radius-full)", padding: "5px 14px", fontSize: "0.75rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(4px)" }}>
            {cls.cefr || "A1"} / Level {cls.level || 1}
          </span>
          <span style={{ background: seatsLeft <= 2 ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.12)", color: "#fff", borderRadius: "var(--radius-full)", padding: "5px 14px", fontSize: "0.75rem", fontWeight: 700, border: `1px solid ${seatsLeft <= 2 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.2)"}` }}>
            {seatsLeft <= 2 ? `${t("classes.detail.urgentSeatsPrefix")} ${seatsLeft} ${t("classes.detail.seatsLeftSuffix")}` : `${seatsLeft} ${t("classes.detail.seatsAvailableSuffix")}`}
          </span>
        </div>

        <h2 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>{cls.name}</h2>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.875rem" }}>{cls.book}{cls.bookCode ? ` (${cls.bookCode})` : ""} / {cls.totalHours || 0} {t("classes.detail.hourUnit")} / {t("classes.detail.perCourse")}</p>
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
                {typeof cls.tutor?.rating === "number" && (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
                    <Star size={12} style={{ color: "#f59e0b", fill: "#f59e0b" }} /> {cls.tutor.rating.toFixed(1)}
                  </span>
                )}
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
                  <Users size={12} /> {cls.tutor?.students || 0} {t("classes.detail.studentsUnit")}
                </span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>{tutorBio}</p>
        </div>

        {/* Schedule */}
        <div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>{t("classes.detail.schedule")}</h3>
          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--brand-100)" }}>
              <Calendar size={20} style={{ color: "var(--brand-600)" }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>{cls.schedule}</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: 2 }}>{t("classes.detail.nextLessonPrefix")} {cls.nextSession || "TBA"}</div>
            </div>
          </div>
        </div>

        {/* Capacity */}
        <div className="glass-card" style={{ padding: "18px" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>{t("classes.detail.seats")}</h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{cls.students} {t("classes.detail.from")} {cls.maxStudents} {t("classes.detail.peopleUnit")}</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: seatsLeft <= 2 ? "var(--accent-red)" : "var(--brand-600)" }}>{t("classes.detail.remainingPrefix")} {seatsLeft} {t("classes.detail.seatsLeftSuffix")}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${fillPct}%`, background: seatsLeft <= 2 ? "linear-gradient(90deg, var(--accent-red), #f87171)" : undefined }} />
          </div>
        </div>

        {canReview && (
          <div className="glass-card" style={{ padding: "18px", border: "1px solid rgba(245,158,11,0.28)", background: "linear-gradient(135deg, rgba(245,158,11,0.10), var(--surface-card))" }}>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
              ให้คะแนนคุณครู
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
              คะแนนนี้จะถูกนำไปคำนวณเรตติ้งเฉลี่ยจริงบนหน้า Performance ของครู
            </p>

            {reviewLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 700 }}>
                <Loader2 size={16} className="animate-spin" />
                กำลังโหลดรีวิวของคุณ...
              </div>
            ) : review && !reviewEditing ? (
              /* ── Read-only: already reviewed ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#22c55e" }}>รีวิวแล้ว</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      size={22}
                      fill={value <= review.rating ? "#f59e0b" : "transparent"}
                      color={value <= review.rating ? "#f59e0b" : "var(--neutral-300)"}
                    />
                  ))}
                </div>
                {review.comment && (
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                    {review.comment}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setReviewEditing(true)}
                  style={{
                    alignSelf: "flex-start",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    background: "none",
                    border: "1px solid var(--surface-border)",
                    borderRadius: 10,
                    padding: "6px 14px",
                    cursor: "pointer",
                  }}
                >
                  แก้ไขรีวิว
                </button>
              </div>
            ) : (
              /* ── Editable form ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReviewRating(value)}
                      aria-label={`ให้ ${value} ดาว`}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        border: value <= reviewRating ? "1px solid rgba(245,158,11,0.45)" : "1px solid var(--surface-border)",
                        background: value <= reviewRating ? "rgba(245,158,11,0.14)" : "var(--surface-card)",
                        color: value <= reviewRating ? "#f59e0b" : "var(--neutral-300)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Star size={22} fill={value <= reviewRating ? "#f59e0b" : "transparent"} />
                    </button>
                  ))}
                </div>

                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="เล่าความประทับใจหรือข้อเสนอแนะเพิ่มเติม"
                  maxLength={500}
                  style={{
                    width: "100%",
                    minHeight: 92,
                    borderRadius: 16,
                    border: "1px solid var(--surface-border)",
                    background: "var(--surface-card)",
                    color: "var(--text-primary)",
                    padding: "12px 14px",
                    fontSize: "0.875rem",
                    lineHeight: 1.6,
                    resize: "vertical",
                    outline: "none",
                  }}
                />

                <div style={{ display: "flex", gap: 8 }}>
                  {reviewEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewRating(review!.rating);
                        setReviewComment(review!.comment ?? "");
                        setReviewEditing(false);
                      }}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 16,
                        fontWeight: 800,
                        fontSize: "0.875rem",
                        border: "1px solid var(--surface-border)",
                        background: "var(--surface-card)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      ยกเลิก
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={reviewSubmitting || reviewRating === 0}
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 16,
                      fontWeight: 800,
                      opacity: reviewSubmitting || reviewRating === 0 ? 0.55 : 1,
                    }}
                  >
                    {reviewSubmitting ? "กำลังบันทึก..." : reviewEditing ? "บันทึกการแก้ไข" : "ส่งรีวิว"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Highlights */}
        <div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>{t("classes.detail.benefits")}</h3>
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
            <h3 className="section-title">{t("classes.detail.lessonPreview")}</h3>
            <span style={{ background: "var(--neutral-100)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: "var(--radius-full)", fontSize: "0.6875rem", fontWeight: 700 }}>{articles.length} {t("classes.detail.from")} {articleCount} {t("classes.detail.lessonsUnit")}</span>
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
              {articleCount > articles.length ? `${t("classes.detail.moreLessonsPrefix")} ${articleCount - articles.length} ${t("classes.detail.moreLessonsSuffix")}` : t("classes.detail.allLessonsAfterPayment")}
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
          <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{t("classes.detail.netPrice")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>THB {cls.price.toLocaleString()}</span>
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
            {t("classes.detail.enrolled")}
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
            {t("classes.detail.enrollNow")}
          </Link>
        )}
      </div>
    </div>
  );
}
