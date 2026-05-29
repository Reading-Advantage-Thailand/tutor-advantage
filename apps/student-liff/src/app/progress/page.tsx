"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLiff } from "@/components/providers/LiffProvider";
import { studentApi } from "@/lib/api";
import { waitForSessionCookie } from "@/lib/cookieUtils";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Lock,
  Map,
  PlayCircle,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

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

interface EnrolledClassOption {
  classId: string;
  name: string;
  cefr: string;
  bookTitle: string | null;
  seriesColor: string;
}

interface ProgressData {
  enrolledClasses?: EnrolledClassOption[];
  selectedClassId?: string | null;
  stats: ProgressStats;
  weeklyActivity: WeeklyActivity[];
  articles: ProgressArticle[];
}

const MASCOT = "🦊";

const JOURNEY_DECORATIONS: Array<{ emoji: string; top: string; delay: string; left?: string; right?: string }> = [
  { emoji: "⭐", top: "6%",  left:  "5%",  delay: "0s"   },
  { emoji: "🌸", top: "28%", right: "4%",  delay: "0.8s" },
  { emoji: "✨", top: "52%", left:  "3%",  delay: "1.5s" },
  { emoji: "🍀", top: "74%", right: "5%",  delay: "0.4s" },
  { emoji: "💫", top: "90%", left:  "6%",  delay: "2s"   },
];

const mapCopy = {
  get title() { return t("progress.map.title"); },
  get subtitle() { return t("progress.map.subtitle"); },
  get current() { return t("progress.map.current"); },
  get completed() { return t("progress.map.completed"); },
  get locked() { return t("progress.map.locked"); },
  get milestone() { return t("progress.map.milestone"); },
  get finalGoal() { return t("progress.map.finalGoal"); },
  get tapToRead() { return t("progress.map.tapToRead"); },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getJourneyState(articles: ProgressArticle[]) {
  const firstIncompleteIndex = articles.findIndex((article) => !article.done);
  const currentIndex =
    articles.length === 0
      ? -1
      : firstIncompleteIndex >= 0
        ? firstIncompleteIndex
        : articles.length - 1;

  return { currentIndex };
}

function getMilestoneLabel(article: ProgressArticle, index: number, total: number) {
  if (index === total - 1) return mapCopy.finalGoal;
  if ((article.no || index + 1) % 5 === 0) return mapCopy.milestone;
  return null;
}

function LearningJourneyMap({
  articles,
  seriesColor,
}: {
  articles: ProgressArticle[];
  seriesColor: string;
}) {
  const { currentIndex } = getJourneyState(articles);

  if (articles.length === 0) {
    return (
      <section className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Map size={19} style={{ color: "var(--brand-600)" }} />
          <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }}>
            {mapCopy.title}
          </h3>
        </div>
        <p style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
          {t("progress.noData")}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="learning-journey-title"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--radius-2xl)",
        background: "linear-gradient(180deg, var(--surface-card), var(--surface-elevated))",
        border: "1px solid var(--surface-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Ambient blobs */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 18% 14%, rgba(6,199,85,0.07) 0 8px, transparent 9px), radial-gradient(circle at 82% 20%, rgba(59,130,246,0.07) 0 10px, transparent 11px), radial-gradient(circle at 72% 82%, rgba(245,158,11,0.09) 0 12px, transparent 13px)",
          pointerEvents: "none",
        }}
      />

      {/* Floating decorative elements */}
      {JOURNEY_DECORATIONS.map((d, i) => (
        <div
          key={i}
          className="sparkle-twinkle"
          aria-hidden
          style={{
            position: "absolute",
            top: d.top,
            left: "left" in d ? d.left : undefined,
            right: "right" in d ? d.right : undefined,
            fontSize: "0.9rem",
            pointerEvents: "none",
            userSelect: "none",
            animationDelay: d.delay,
            zIndex: 0,
          }}
        >
          {d.emoji}
        </div>
      ))}

      <div style={{ position: "relative", zIndex: 1, padding: "20px 16px 18px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: "var(--brand-50)",
                  border: "1px solid var(--brand-100)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Map size={18} style={{ color: "var(--brand-600)" }} />
              </div>
              <h3 id="learning-journey-title" style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {mapCopy.title}
              </h3>
            </div>
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.75rem", marginLeft: 43 }}>
              {mapCopy.subtitle}
            </p>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <div style={{ fontSize: "1.25rem", lineHeight: 1, fontWeight: 900, color: seriesColor }}>
              {clamp(currentIndex + 1, 0, articles.length)}
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", fontWeight: 700 }}>
              / {articles.length}
            </div>
          </div>
        </div>

        <div style={{ position: "relative", padding: "4px 0 2px" }}>
          {/* Dashed path line */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 28,
              bottom: 28,
              left: "50%",
              width: 3,
              transform: "translateX(-50%)",
              borderRadius: "var(--radius-full)",
              backgroundImage: `repeating-linear-gradient(180deg, ${seriesColor}55 0px, ${seriesColor}55 8px, transparent 8px, transparent 15px)`,
            }}
          />

          {articles.map((article, index) => {
            const isComplete = article.done;
            const isCurrent = index === currentIndex && !article.done;
            const isUnlocked = index <= currentIndex || isComplete;
            const isLeft = index % 2 === 0;
            const milestone = getMilestoneLabel(article, index, articles.length);
            const isFinalGoal = milestone === mapCopy.finalGoal;
            const isMilestone = milestone === mapCopy.milestone;

            /* Node sizing */
            const nodeSize = isCurrent ? 60 : isFinalGoal ? 56 : (isMilestone && isUnlocked) ? 52 : isComplete ? 52 : 46;

            /* Node background */
            const nodeBg = isComplete
              ? `linear-gradient(145deg, ${seriesColor} 0%, ${seriesColor}cc 100%)`
              : isFinalGoal && isUnlocked
                ? "linear-gradient(145deg, #f59e0b, #d97706)"
                : isMilestone && isUnlocked
                  ? "linear-gradient(145deg, #fbbf24, #f59e0b)"
                  : isCurrent
                    ? "var(--surface-card)"
                    : "var(--neutral-100)";

            /* Node shadow (undefined = handled by CSS animation class) */
            const nodeShadow = isCurrent
              ? undefined
              : isComplete
                ? `0 5px 0 ${seriesColor}66, 0 8px 20px rgba(6,199,85,0.2)`
                : isFinalGoal && isUnlocked
                  ? "0 5px 0 #b45309, 0 8px 20px rgba(245,158,11,0.3)"
                  : isMilestone && isUnlocked
                    ? "0 5px 0 #92400e55, 0 8px 20px rgba(245,158,11,0.2)"
                    : "0 4px 0 var(--neutral-200), 0 2px 8px rgba(0,0,0,0.05)";

            /* Node icon / content */
            const nodeContent = isComplete ? (
              <span style={{ fontSize: "1.2rem" }}>✓</span>
            ) : isFinalGoal ? (
              <span style={{ fontSize: "1.5rem" }}>🎯</span>
            ) : isMilestone && isUnlocked ? (
              <span style={{ fontSize: "1.2rem" }}>🏆</span>
            ) : (
              <span style={{ fontSize: "0.8125rem", fontWeight: 900 }}>
                {isUnlocked ? article.no : <Lock size={16} />}
              </span>
            );

            /* Card border / shadow */
            const cardBorder = isCurrent
              ? `1.5px solid ${seriesColor}`
              : isFinalGoal
                ? "1.5px solid #f59e0b"
                : "1px solid var(--surface-border)";

            const cardShadow = isCurrent
              ? `0 8px 24px rgba(6,199,85,0.16)`
              : isFinalGoal
                ? "0 8px 24px rgba(245,158,11,0.16)"
                : "0 4px 12px rgba(15,23,42,0.05)";

            const nodeEntryAnim = `journey-node-in 0.45s cubic-bezier(0.34,1.56,0.64,1) ${Math.min(index * 45, 350)}ms both`;

            const checkpoint = (
              /* Extra top padding creates space for the floating mascot */
              <div style={{ position: "relative", paddingTop: isCurrent ? 42 : 0 }}>
                {isCurrent && (
                  <div
                    className="mascot-float"
                    aria-hidden
                    style={{ top: 0, fontSize: "2rem", zIndex: 3, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.12))" }}
                  >
                    {MASCOT}
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 64px 1fr",
                    alignItems: "center",
                    minHeight: 88,
                    position: "relative",
                  }}
                >
                  {/* Article card */}
                  <div style={{ gridColumn: isLeft ? "1" : "3", justifySelf: isLeft ? "end" : "start", width: "min(100%, 164px)" }}>
                    <div
                      style={{
                        padding: "10px 11px",
                        borderRadius: 14,
                        background: "var(--surface-card)",
                        border: cardBorder,
                        boxShadow: cardShadow,
                        transform: isCurrent ? "translateY(-2px)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        {isFinalGoal ? (
                          <span style={{ fontSize: "0.75rem" }}>🎯</span>
                        ) : isMilestone ? (
                          <Trophy size={13} style={{ color: "var(--accent-amber)" }} />
                        ) : isCurrent ? (
                          <Sparkles size={13} style={{ color: seriesColor }} />
                        ) : (
                          <BookOpen size={13} style={{ color: isUnlocked ? "var(--brand-600)" : "var(--neutral-300)" }} />
                        )}
                        <span
                          style={{
                            color: isCurrent ? seriesColor : isFinalGoal ? "#f59e0b" : "var(--text-tertiary)",
                            fontSize: "0.625rem",
                            fontWeight: 800,
                          }}
                        >
                          {milestone || (isCurrent ? mapCopy.current : `${t("progress.articleUnit")} ${article.no}`)}
                        </span>
                      </div>

                      <div
                        className="line-clamp-2"
                        style={{
                          color: isUnlocked ? "var(--text-primary)" : "var(--text-tertiary)",
                          fontSize: "0.8125rem",
                          fontWeight: 750,
                          lineHeight: 1.35,
                          minHeight: 35,
                        }}
                      >
                        {article.title}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          marginTop: 7,
                          color: isUnlocked ? "var(--text-tertiary)" : "var(--neutral-300)",
                          fontSize: "0.625rem",
                          fontWeight: 700,
                        }}
                      >
                        {isComplete ? (
                          <><CheckCircle2 size={11} />{mapCopy.completed}</>
                        ) : isCurrent ? (
                          <><PlayCircle size={11} />{mapCopy.tapToRead}</>
                        ) : (
                          <><Lock size={11} />{mapCopy.locked}</>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center node (game-style 3D button) */}
                  <div
                    className={
                      isCurrent
                        ? "node-pulse-ring"
                        : isFinalGoal && isUnlocked
                          ? "milestone-glow"
                          : ""
                    }
                    style={{
                      gridColumn: "2",
                      justifySelf: "center",
                      width: nodeSize,
                      height: nodeSize,
                      borderRadius: "50%",
                      background: nodeBg,
                      border: isCurrent
                        ? `3px solid ${seriesColor}`
                        : isComplete || (isUnlocked && (isMilestone || isFinalGoal))
                          ? "none"
                          : `2px solid ${isUnlocked ? "var(--neutral-300)" : "var(--neutral-200)"}`,
                      boxShadow: nodeShadow,
                      color: isComplete || (isUnlocked && (isMilestone || isFinalGoal))
                        ? "#fff"
                        : isCurrent
                          ? seriesColor
                          : "var(--neutral-400)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 2,
                      flexShrink: 0,
                      animation: nodeEntryAnim,
                    }}
                  >
                    {nodeContent}
                  </div>
                </div>
              </div>
            );

            return isUnlocked ? (
              <Link
                href={`/student/read/${article.id}`}
                key={article.id}
                aria-label={`${mapCopy.tapToRead}: ${article.title}`}
                style={{ display: "block", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}
              >
                {checkpoint}
              </Link>
            ) : (
              <div key={article.id} aria-disabled="true">
                {checkpoint}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function ProgressPage() {
  const { isReady } = useLiff();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!isReady) return;

      try {
        if (!selectedClassId) setLoading(true);
        else setSwitching(true);

        const token = await waitForSessionCookie();
        if (!token) {
          throw new Error("Session unavailable");
        }

        const result = await studentApi.getStudentProgress(selectedClassId || undefined) as ProgressData;
        if (isMounted) {
          setData(result);
          if (!selectedClassId && result.selectedClassId) {
            setSelectedClassId(result.selectedClassId);
          }
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError(t("progress.loadFailed"));
        }
      } finally {
        if (isMounted) { setLoading(false); setSwitching(false); }
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [isReady, selectedClassId]);

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
        <p className="text-slate-500">{error || t("progress.noData")}</p>
        <Button onClick={() => window.location.reload()}>{t("progress.retry")}</Button>
      </div>
    );
  }

  const { stats, weeklyActivity, articles } = data;
  const hasData = stats.totalArticles > 0 || articles.length > 0;
  const progressPct = stats.totalArticles > 0 ? Math.round((stats.articlesRead / stats.totalArticles) * 100) : 0;
  const maxMin = Math.max(...(weeklyActivity.map((d) => d.minutes) || [0]), 1);
  const hasWeeklyActivity = weeklyActivity.some((d) => d.minutes > 0);
  const currentArticleIdx = articles.findIndex((a) => !a.done);

  return (
    <div>
      {/* Header */}
      <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)" }}>
        <h1 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>{t("progress.title")}</h1>
        {hasData && (
          <span style={{ background: "var(--brand-50)", color: "var(--brand-700)", padding: "5px 12px", borderRadius: "var(--radius-full)", fontSize: "0.75rem", fontWeight: 700, border: "1px solid var(--brand-100)" }}>
            {stats.level} / {stats.cefr}
          </span>
        )}
      </div>

      {/* Class selector */}
      {data.enrolledClasses && data.enrolledClasses.length > 1 && (
        <div style={{ padding: "0 16px", paddingTop: 8 }}>
          <div className="scrollbar-hide" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {data.enrolledClasses.map((cls) => {
              const isActive = cls.classId === (data.selectedClassId ?? selectedClassId);
              return (
                <button
                  key={cls.classId}
                  onClick={() => { if (!isActive && !switching) setSelectedClassId(cls.classId); }}
                  disabled={switching}
                  style={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: "var(--radius-full, 9999px)",
                    border: isActive ? `2px solid ${cls.seriesColor}` : "1.5px solid var(--surface-border)",
                    background: isActive ? `${cls.seriesColor}12` : "var(--surface-card)",
                    color: isActive ? cls.seriesColor : "var(--text-secondary)",
                    fontSize: "0.8125rem",
                    fontWeight: isActive ? 700 : 500,
                    cursor: switching ? "wait" : "pointer",
                    opacity: switching && !isActive ? 0.5 : 1,
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: cls.seriesColor,
                    flexShrink: 0,
                  }} />
                  {cls.name}
                  <span style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    background: isActive ? cls.seriesColor : "var(--neutral-200)",
                    color: isActive ? "#fff" : "var(--text-tertiary)",
                    padding: "1px 6px",
                    borderRadius: "var(--radius-full, 9999px)",
                  }}>
                    {cls.cefr}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Switching overlay */}
      {switching && (
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
          <div className="animate-spin" style={{ width: 20, height: 20, border: "2px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
        </div>
      )}

      <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 16, opacity: switching ? 0.5 : 1, transition: "opacity 0.2s" }}>

        {/* Main progress card */}
        <div className="curved-bottom" style={{ background: `linear-gradient(135deg, ${hasData ? stats.seriesColor : "#06c755"} 0%, #037d36 100%)`, borderRadius: 24, overflow: "hidden", position: "relative" }}>
          <div aria-hidden style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ padding: "24px 20px" }}>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.75rem", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("progress.currentLevel")}</p>
            {hasData ? (
              <>
                <h2 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, marginBottom: 20 }}>{stats.level}</h2>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8125rem" }}>{stats.articlesRead} {t("progress.from")} {stats.totalArticles} {t("progress.articleUnit")}</span>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.875rem" }}>{progressPct}%</span>
                  </div>
                  <div style={{ height: 8, background: "rgba(255,255,255,0.15)", borderRadius: 20, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #fff, #bbf7d0)", borderRadius: 20, transition: "width 0.6s ease", boxShadow: "0 0 10px rgba(255,255,255,0.3)" }} />
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.15)" }}>
                  <Target size={16} style={{ color: "#fbbf24", flexShrink: 0 }} />
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.8125rem" }}>
                    {t("progress.remainingPrefix")} <strong>{stats.nextMilestone.at - stats.articlesRead} {t("progress.articleUnit")}</strong> {t("progress.receive")} {stats.nextMilestone.reward}
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, marginBottom: 12 }}>{t("progress.noEnrollment")}</h2>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8125rem", marginBottom: 16 }}>{t("progress.noEnrollmentSub")}</p>
                <Link href="/classes">
                  <button style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "10px 20px", borderRadius: 14, fontSize: "0.875rem", fontWeight: 700, cursor: "pointer" }}>
                    {t("progress.findClass")}
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>

        <LearningJourneyMap articles={articles} seriesColor={stats.seriesColor} />

        {/* Stat chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { Icon: Flame, label: t("progress.streak"), value: `${stats.weekStreak} ${t("progress.weekUnit")}`, bgColor: "var(--accent-amber-light)", iconColor: "var(--accent-amber)" },
            { Icon: Clock, label: t("progress.studyTime"), value: `${stats.totalMinutes} ${t("progress.minuteUnit")}`, bgColor: "var(--accent-blue-light)", iconColor: "var(--accent-blue)" },
            { Icon: BookOpen, label: t("progress.completedLessons"), value: `${stats.articlesRead} ${t("progress.articleUnit")}`, bgColor: "var(--brand-50)", iconColor: "var(--brand-600)" },
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
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>{t("progress.weeklyActivity")}</h3>
          {hasWeeklyActivity ? (
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
          ) : (
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem", textAlign: "center", padding: "16px 0" }}>
              {t("progress.noActivityYet")}
            </p>
          )}
        </div>

        {/* Article list */}
        <div>
          <div className="section-header">
            <h3 className="section-title">{t("progress.allLessons")}</h3>
            <span style={{ background: "var(--neutral-100)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: "var(--radius-full)", fontSize: "0.6875rem", fontWeight: 700 }}>
              {stats.articlesRead}/{stats.totalArticles}
            </span>
          </div>

          <div className="glass-card" style={{ overflow: "hidden" }}>
            {articles.length === 0 && (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <BookOpen size={24} style={{ color: "var(--neutral-300)", marginInline: "auto", marginBottom: 8 }} />
                <p style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>{t("progress.noLessonsYet")}</p>
              </div>
            )}
            {articles.map((art, idx) => {
              const isCur = idx === currentArticleIdx;
              const isInteractive = art.done || isCur;

              const row = (
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                    borderTop: idx > 0 ? "1px solid var(--surface-border)" : "none",
                    opacity: !art.done && !isCur ? 0.5 : 1,
                    background: isCur ? `${stats.seriesColor}08` : "transparent",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: art.done ? "var(--brand-100)" : isCur ? `${stats.seriesColor}22` : "var(--neutral-100)",
                    border: `2px solid ${art.done ? "var(--brand-400)" : isCur ? stats.seriesColor : "var(--neutral-200)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {art.done ? (
                      <CheckCircle2 size={14} style={{ color: "var(--brand-600)" }} />
                    ) : isCur ? (
                      <PlayCircle size={13} style={{ color: stats.seriesColor }} />
                    ) : (
                      <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-tertiary)" }}>{art.no}</span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: isCur ? 700 : 600, color: art.done || isCur ? "var(--text-primary)" : "var(--text-tertiary)" }} className="text-ellipsis">
                      {art.title}
                    </div>
                    {art.done && (
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} /> {art.minutes} {t("progress.minuteUnit")}
                      </div>
                    )}
                  </div>

                  {art.done ? (
                    <span style={{ background: "var(--brand-50)", color: "var(--brand-700)", fontSize: "0.625rem", fontWeight: 700, padding: "3px 8px", borderRadius: 8, flexShrink: 0 }}>
                      {t("progress.done")}
                    </span>
                  ) : isCur ? (
                    <span style={{ background: `${stats.seriesColor}22`, color: stats.seriesColor, fontSize: "0.625rem", fontWeight: 700, padding: "3px 8px", borderRadius: 8, border: `1px solid ${stats.seriesColor}44`, flexShrink: 0 }}>
                      ▶ เรียน
                    </span>
                  ) : (
                    <Lock size={14} style={{ color: "var(--neutral-300)", flexShrink: 0 }} />
                  )}
                </div>
              );

              return isInteractive ? (
                <Link
                  key={art.id}
                  href={`/student/read/${art.id}`}
                  style={{ display: "block", textDecoration: "none", color: "inherit", WebkitTapHighlightColor: "transparent" }}
                >
                  {row}
                </Link>
              ) : (
                <div key={art.id}>{row}</div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
