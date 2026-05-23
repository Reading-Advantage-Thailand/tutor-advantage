"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { studentApi } from "@/lib/api";
import { t } from "@/lib/i18n";

interface Answer {
  phase: number;
  score: number;
  question: string;
  answer: string;
  isCorrect: boolean;
  correctAnswer?: string;
  aiFeedback?: string;
}

interface Session {
  articleTitle: string;
  tutorName: string;
  date: string;
  totalScore: number;
  rank?: number;
  totalParticipants?: number;
}

interface LessonDetail {
  session: Session;
  answers: Answer[];
}

const RANK_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function LessonHistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      const fetchDetail = async () => {
        try {
          const data = await studentApi.getLessonSessionDetails(sessionId);
          setDetail(data);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
          setError(errorMessage || t("lessonHistory.detailLoadFailed"));
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", gap: 16, background: "var(--surface-bg)" }}>
        <div style={{ fontSize: "3rem" }}>😕</div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("lessonHistory.errorTitle")}</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", maxWidth: 280 }}>{error || t("lessonHistory.detailNotFound")}</p>
        <button
          onClick={() => router.back()}
          style={{ padding: "10px 24px", borderRadius: "var(--radius-xl)", background: "var(--brand-500)", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontSize: "0.875rem" }}
        >
          {t("lessonHistory.back")}
        </button>
      </div>
    );
  }

  const { session, answers } = detail;
  const rankEmoji = session.rank ? (RANK_EMOJI[session.rank] ?? "🎖️") : null;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-bg)", paddingBottom: 48 }}>
      {/* Sticky Top Bar */}
      <div style={{
        padding: "14px 20px",
        background: "var(--surface-card)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid var(--surface-border)",
        backdropFilter: "blur(8px)",
      }}>
        <button
          onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "var(--neutral-100)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <ChevronLeft size={18} style={{ color: "var(--text-primary)" }} />
        </button>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t("lessonHistory.summaryTitle")}
        </h1>
      </div>

      {/* Hero Banner */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        padding: "32px 20px 28px",
        background: "linear-gradient(135deg, #06c755 0%, #059669 60%, #0d9488 100%)",
        color: "white",
        textAlign: "center",
      }}>
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: -24, right: -24, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "40%", right: "20%", width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        {/* Trophy */}
        <div style={{ fontSize: "3rem", marginBottom: 12, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }}>🏆</div>

        <h2 style={{ fontSize: "1.125rem", fontWeight: 800, marginBottom: 6, lineHeight: 1.35, padding: "0 8px" }}>
          {session.articleTitle}
        </h2>
        <p style={{ fontSize: "0.8125rem", opacity: 0.9, marginBottom: 20 }}>
          {t("lessonHistory.tutorPrefix")} {session.tutorName} · 📅 {new Date(session.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {/* Score + Rank Badges */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Score */}
          <div style={{ background: "white", color: "#059669", borderRadius: 16, padding: "10px 20px", display: "flex", alignItems: "baseline", gap: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
            <span style={{ fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#059669" }}>Score</span>
            <span style={{ fontSize: "1.75rem", fontWeight: 900, lineHeight: 1 }}>{session.totalScore}</span>
            <span style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", opacity: 0.6 }}>pts</span>
          </div>

          {/* Rank */}
          {session.rank && (
            <div style={{ background: "rgba(255,255,255,0.22)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.32)", color: "white", borderRadius: 16, padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{rankEmoji}</span>
              <div>
                <div style={{ fontSize: "0.5625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.85 }}>Rank</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 900, lineHeight: 1 }}>
                  {session.rank}
                  {session.totalParticipants && (
                    <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>/{session.totalParticipants}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Answers Section */}
      <div style={{ padding: "20px 16px" }}>
        {/* Section Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
            📝 {t("lessonHistory.answerSection")}
          </h3>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", background: "var(--neutral-100)", padding: "4px 12px", borderRadius: 20, fontWeight: 600 }}>
            {answers.length} {t("lessonHistory.questionUnit")}
          </span>
        </div>

        {answers.length === 0 ? (
          <div className="glass-card" style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>🤔</div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{t("lessonHistory.emptyAnswers")}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {answers.map((a: Answer, index: number) => {
              const rawAnswer = a.answer || t("lessonHistory.unspecified");
              const match = rawAnswer.match(new RegExp(`^${t("lessonHistory.optionPrefix")}\\s+([A-Z]):\\s*(.+)$`, "i")) || rawAnswer.match(/^([A-D])\s*:\s*(.+)$/i);
              const displayLabel = match ? match[1].toUpperCase() : null;
              const displayText = match ? match[2] : rawAnswer;

              return (
                <div
                  key={index}
                  className="glass-card"
                  style={{ overflow: "hidden", animation: `journey-node-in 0.4s cubic-bezier(0.34,1.56,0.64,1) ${Math.min(index * 60, 300)}ms both` }}
                >
                  {/* Phase Header */}
                  <div style={{
                    padding: "10px 16px",
                    background: "var(--neutral-100)",
                    borderBottom: "1px solid var(--surface-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand-500)", display: "inline-block" }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Phase {a.phase}
                      </span>
                    </div>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: "0.8125rem",
                      background: a.score > 0 ? "rgba(5,150,105,0.1)" : "rgba(239,68,68,0.1)",
                      color: a.score > 0 ? "#059669" : "#dc2626",
                    }}>
                      <span>{a.score > 0 ? "✅" : "❌"}</span>
                      <span>+{a.score} Pts</span>
                    </div>
                  </div>

                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Question */}
                    <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.5, margin: 0 }}>
                      {a.question || t("lessonHistory.questionFallback")}
                    </p>

                    {/* Student Answer */}
                    <div style={{
                      borderRadius: 14,
                      border: `2px solid ${a.isCorrect ? "rgba(16,185,129,0.3)" : "rgba(248,113,113,0.3)"}`,
                      background: a.isCorrect ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}>
                      {displayLabel ? (
                        <div style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: "1.25rem",
                          flexShrink: 0,
                          background: a.isCorrect ? "linear-gradient(135deg, #059669, #06c755)" : "linear-gradient(135deg, #dc2626, #ef4444)",
                          color: "white",
                          boxShadow: a.isCorrect ? "0 4px 12px rgba(5,150,105,0.35)" : "0 4px 12px rgba(239,68,68,0.35)",
                        }}>
                          {displayLabel}
                        </div>
                      ) : (
                        <span style={{ fontSize: "1.75rem", lineHeight: 1, flexShrink: 0 }}>{a.isCorrect ? "✅" : "❌"}</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4, color: a.isCorrect ? "#10b981" : "#f87171" }}>
                          {t("lessonHistory.yourAnswer")}
                        </span>
                        <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4, margin: 0 }}>
                          {displayText}
                        </p>
                      </div>
                    </div>

                    {/* Correct Answer */}
                    {!a.isCorrect && a.correctAnswer && (
                      <div style={{
                        borderRadius: 14,
                        border: "1px solid rgba(251,191,36,0.35)",
                        background: "rgba(251,191,36,0.1)",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}>
                        <span style={{ fontSize: "1.5rem", flexShrink: 0, lineHeight: 1 }}>💡</span>
                        <div>
                          <span style={{ display: "block", fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4, color: "#fbbf24" }}>
                            {t("lessonHistory.correctAnswer")}
                          </span>
                          <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{a.correctAnswer}</p>
                        </div>
                      </div>
                    )}

                    {/* AI Feedback */}
                    {a.aiFeedback && (
                      <div style={{
                        borderRadius: 14,
                        border: "1px solid rgba(129,140,248,0.3)",
                        background: "rgba(99,102,241,0.08)",
                        padding: "12px 14px",
                        display: "flex",
                        gap: 12,
                      }}>
                        <span style={{ fontSize: "1.5rem", flexShrink: 0, lineHeight: 1 }}>🤖</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, color: "#a5b4fc", background: "rgba(99,102,241,0.15)", padding: "2px 8px", borderRadius: 20 }}>
                            <span className="animate-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
                            AI Evaluation
                          </span>
                          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--text-primary)", fontWeight: 500, whiteSpace: "pre-line", margin: 0 }}>
                            {a.aiFeedback}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
