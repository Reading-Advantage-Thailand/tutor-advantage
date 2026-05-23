"use client";

import React, { useState, useEffect } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { studentApi } from "@/lib/api";
import { t } from "@/lib/i18n";

interface HistoryItem {
  sessionId: string;
  date: string;
  rank: number;
  totalParticipants: number;
  articleTitle: string;
  tutorName: string;
  score: number;
}

const RANK_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function AllHistoryPage() {
  const { isReady, profile } = useLiff();
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && profile) {
      const fetchHistory = async () => {
        try {
          const hist = await studentApi.getLessonHistory();
          setHistoryData(hist.history || []);
          setLoading(false);
        } catch (err) {
          console.error("Failed to fetch history:", err);
          setError(err instanceof Error ? err.message : t("lessonHistory.loadFailed"));
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isReady, profile]);

  if (!isReady || loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", gap: 16, background: "var(--surface-bg)" }}>
        <div style={{ fontSize: "3rem" }}>😕</div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("lessonHistory.errorTitle")}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "10px 24px", borderRadius: "var(--radius-xl)", background: "var(--brand-500)", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontSize: "0.875rem" }}
        >
          {t("lessonHistory.retry")}
        </button>
      </div>
    );
  }

  const groupedHistory: Record<string, HistoryItem[]> = {};
  historyData.forEach(hist => {
    const date = new Date(hist.date);
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const key = date.toLocaleDateString('th-TH', options);
    if (!groupedHistory[key]) groupedHistory[key] = [];
    groupedHistory[key].push(hist);
  });

  return (
    <div style={{ background: "var(--surface-bg)", minHeight: "100dvh", paddingBottom: 40 }}>
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
        <Link
          href="/dashboard"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", background: "var(--neutral-100)", textDecoration: "none", flexShrink: 0 }}
        >
          <ArrowLeft size={18} style={{ color: "var(--text-primary)" }} />
        </Link>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>{t("lessonHistory.title")}</h1>
        <span style={{ fontSize: "1.25rem" }}>🏆</span>
      </div>

      {/* Hero Banner */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        padding: "28px 20px 24px",
        background: "linear-gradient(135deg, #06c755 0%, #059669 60%, #0d9488 100%)",
        textAlign: "center",
        color: "white",
      }}>
        <div style={{ position: "absolute", top: -24, right: -24, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -16, left: -16, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />

        <div style={{ fontSize: "2.5rem", marginBottom: 8, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" }}>📚</div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 800, marginBottom: 4 }}>{t("lessonHistory.title")}</h2>
        <p style={{ fontSize: "0.8125rem", opacity: 0.85 }}>
          {historyData.length > 0 ? `${historyData.length} บทเรียน` : t("lessonHistory.empty")}
        </p>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {historyData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>📜</div>
            <p>{t("lessonHistory.empty")}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {Object.keys(groupedHistory).map(dateStr => (
              <div key={dateStr}>
                <h3 style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  marginBottom: 10,
                  letterSpacing: "0.03em",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  {dateStr}
                  <span style={{ flex: 1, height: 1, background: "linear-gradient(to right, var(--surface-border), transparent)" }} />
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {groupedHistory[dateStr].map((hist) => {
                    const medalEmoji = RANK_EMOJI[hist.rank];
                    return (
                      <Link
                        key={hist.sessionId}
                        href={`/lesson/history/${hist.sessionId}`}
                        className="glass-card clickable-effect"
                        style={{ textDecoration: "none", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}
                      >
                        {/* Rank Badge */}
                        <div style={{
                          width: 46,
                          height: 46,
                          borderRadius: 12,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          background: hist.rank === 1
                            ? "rgba(245,158,11,0.12)"
                            : hist.rank === 2
                            ? "rgba(148,163,184,0.12)"
                            : "var(--neutral-100)",
                        }}>
                          {medalEmoji ? (
                            <span style={{ fontSize: "1.625rem", lineHeight: 1 }}>{medalEmoji}</span>
                          ) : (
                            <>
                              <span style={{ fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", lineHeight: 1 }}>RANK</span>
                              <div style={{ display: "flex", alignItems: "baseline", marginTop: 2 }}>
                                <span style={{ fontSize: "1.125rem", lineHeight: 1, color: "var(--text-secondary)", fontWeight: 800 }}>{hist.rank}</span>
                                {hist.totalParticipants > 0 && (
                                  <span style={{ fontSize: "0.625rem", color: "var(--text-tertiary)" }}>/{hist.totalParticipants}</span>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {hist.articleTitle}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                            <span>{t("lessonHistory.tutorPrefix")} {hist.tutorName}</span>
                            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor", opacity: 0.5 }} />
                            <span>{new Date(hist.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} {t("lessonHistory.timeSuffix")}</span>
                          </div>
                        </div>

                        {/* Score */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.15)", color: "#059669", padding: "6px 10px", borderRadius: 10, minWidth: 44 }}>
                          <div style={{ fontSize: "0.875rem", fontWeight: 800, lineHeight: 1 }}>{hist.score}</div>
                          <div style={{ fontSize: "0.5625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.9, marginTop: 3 }}>PTS</div>
                        </div>

                        <ChevronRight size={16} style={{ color: "var(--neutral-300)" }} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
