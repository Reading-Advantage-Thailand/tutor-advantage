"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  MessageCircle,
  Calendar,
  CreditCard,
  ChevronRight,
  Flame,
  AlertCircle,
  Glasses,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { studentApi } from "@/lib/api";
import { t } from "@/lib/i18n";
import { playSound } from "@/lib/sounds";
import { waitForSessionCookie } from "@/lib/cookieUtils";

/* ─── Sound helper ─── */
const playNotificationSound = () => {
  try {
    if (typeof window !== "undefined" && localStorage.getItem("app-notif-muted") === "true") return;
    playSound("notification");
  } catch {
    // Silently catch
  }
};

/* ─── Pending payment helper ─── */
function isPendingPayment(status: string): boolean {
  const s = status?.toLowerCase() ?? "";
  return (
    s.includes("pending") ||
    s === "awaiting_payment" ||
    s === "unpaid" ||
    s === "payment_required"
  );
}

/* ─── Types ─── */
interface Enrollment {
  id?: string;
  name: string;
  tutorName: string;
  status: string;
  nextSession: string;
  progress: number;
  bookName: string | null;
  seriesCefr: string | null;
  isLive?: boolean;
  price?: number;
}

interface DashboardData {
  unreadMessages: number;
  weekStreak: number;
  activeEnrollments: number;
  recentClasses: Enrollment[];
  shareableClasses?: Enrollment[];
  todayHistory?: LessonHistoryItem[];
}

interface LessonHistoryItem {
  sessionId: string;
  date: string;
  rank: number;
  totalParticipants: number;
  articleTitle: string;
  tutorName: string;
  score: number;
}

/* ─── Class Card ─── */
function ClassCard({ enrollment }: { enrollment: Enrollment }) {
  const isLive = enrollment.isLive;
  const isPending = isPendingPayment(enrollment.status);

  return (
    <Link
      href={enrollment.id ? `/lesson/${enrollment.id}` : "/classes"}
      className="block no-underline active:scale-[0.98] transition-transform min-w-[260px] max-w-[280px]"
    >
      <div
        className={`h-full rounded-2xl border overflow-hidden shadow-sm transition-all ${
          isLive
            ? "border-rose-400/60 bg-card"
            : isPending
            ? "border-amber-400/50 bg-amber-500/5"
            : "border-border bg-card"
        }`}
      >
        {/* Card top color bar */}
        <div
          className={`h-1.5 w-full ${
            isLive
              ? "bg-gradient-to-r from-rose-500 to-pink-500"
              : isPending
              ? "bg-gradient-to-r from-amber-400 to-orange-400"
              : "bg-gradient-to-r from-indigo-500 to-violet-500"
          }`}
        />

        <div className="p-4 flex flex-col gap-3">
          {/* Live / Pending badge */}
          {isLive && (
            <div className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {t("dashboard.liveNow")}
            </div>
          )}
          {isPending && !isLive && (
            <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider w-fit">
              <AlertTriangle size={9} />
              {t("dashboard.statusPending")}
            </div>
          )}
          {!isLive && !isPending && (
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit">
              <BookOpen size={9} />
              {t("dashboard.statusActive")}
            </div>
          )}

          {/* Class name */}
          <h3 className="font-black text-foreground text-sm leading-snug line-clamp-2">
            {enrollment.name}
          </h3>

          {/* Tutor */}
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users size={11} />
            {enrollment.tutorName}
          </p>

          {/* Next session */}
          {enrollment.nextSession && enrollment.nextSession !== "-" && (
            <div className="flex items-center gap-2 bg-indigo-500/5 border border-indigo-500/15 rounded-xl px-3 py-2">
              <Calendar size={12} className="text-indigo-500 shrink-0" />
              <div>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider leading-none mb-0.5">
                  {t("dashboard.nextLesson")}
                </p>
                <p className="text-xs text-foreground font-medium leading-tight">
                  {enrollment.nextSession}
                </p>
              </div>
            </div>
          )}

          {/* Progress bar (only for non-pending) */}
          {!isPending && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {t("dashboard.progress")}
                </span>
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                  {enrollment.progress}%
                </span>
              </div>
              <Progress value={enrollment.progress} className="h-1.5" />
            </div>
          )}

          {/* Pending CTA */}
          {isPending && (
            <div className="mt-auto pt-1">
              <div className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-black text-xs text-center shadow-sm shadow-amber-400/30 flex items-center justify-center gap-1.5">
                <CreditCard size={12} />
                {t("dashboard.pendingPaymentCta")}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Pending Payment Alert Banner ─── */
function PendingPaymentBanner({ classes }: { classes: Enrollment[] }) {
  if (classes.length === 0) return null;

  return (
    <section className="mx-4 mb-1">
      <div className="rounded-2xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-500/10 to-orange-500/5 overflow-hidden shadow-lg shadow-amber-500/10">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground">
              {t("dashboard.pendingPaymentTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.pendingPaymentSub")}
            </p>
          </div>
          <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-1 rounded-full shrink-0">
            {classes.length} {t("dashboard.pendingPaymentCount")}
          </span>
        </div>

        {/* Class list */}
        <div className="px-4 pb-4 flex flex-col gap-2">
          {classes.map((cls) => (
            <div
              key={cls.id ?? cls.name}
              className="flex items-center gap-3 bg-card rounded-xl px-3 py-3 border border-amber-400/30"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground line-clamp-1">
                  {cls.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {cls.tutorName}
                  {cls.price != null && (
                    <span className="font-bold text-amber-600 dark:text-amber-400 ml-2">
                      THB {cls.price.toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              <Link href={cls.id ? `/payment?classId=${cls.id}` : "/payment"}>
                <button className="shrink-0 flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-black px-3 py-2 rounded-xl shadow-sm active:scale-95 transition-transform">
                  {t("dashboard.pendingPaymentCta")}
                  <ArrowRight size={12} />
                </button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Main Dashboard ─── */
export default function DashboardPage() {
  const { profile, isReady } = useLiff();
  const profileUserId = profile?.userId;

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'loading' | 'copied'>('idle');
  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);
  const [copyingClassId, setCopyingClassId] = useState<string | null>(null);

  const prevUnreadRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!dashboardData) return;
    const currentUnread = dashboardData.unreadMessages ?? 0;
    if (prevUnreadRef.current !== undefined && currentUnread > prevUnreadRef.current) {
      playNotificationSound();
    }
    prevUnreadRef.current = currentUnread;
  }, [dashboardData]);

  useEffect(() => {
    let isMounted = true;
    let cleanupVisibility: (() => void) | undefined;

    if (isReady && profileUserId) {
      const fetchData = async (showLoading = true) => {
        try {
          if (showLoading) setLoading(true);

          const token = await waitForSessionCookie();
          if (!token && isMounted) throw new Error(t("dashboard.sessionCreateFailed"));
          if (!isMounted) return;

          const now = new Date();
          const historyFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const historyTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          const data = await studentApi.getDashboard({
            historyFrom: historyFrom.toISOString(),
            historyTo: historyTo.toISOString(),
          }) as DashboardData;

          if (isMounted) {
            setDashboardData(data);
            setError(null);
          }
        } catch (err: unknown) {
          if (isMounted && showLoading) {
            setError(err instanceof Error ? err.message : t("dashboard.loadFailed"));
          }
        } finally {
          if (isMounted && showLoading) setLoading(false);
        }
      };

      fetchData(true);

      // Refresh on tab focus only — dashboard data is mostly static
      const onVisibility = () => {
        if (!document.hidden) fetchData(false);
      };
      document.addEventListener("visibilitychange", onVisibility);

      cleanupVisibility = () => document.removeEventListener("visibilitychange", onVisibility);
    }

    return () => {
      isMounted = false;
      if (cleanupVisibility) cleanupVisibility();
    };
  }, [isReady, profileUserId]);

  /* ── Derived data ── */
  const allClasses: Enrollment[] = useMemo(() => dashboardData?.recentClasses ?? [], [dashboardData?.recentClasses]);
  const activeClasses = useMemo(() => allClasses.filter((c) => !isPendingPayment(c.status)), [allClasses]);
  const pendingClasses = useMemo(() => allClasses.filter((c) => isPendingPayment(c.status)), [allClasses]);
  const shareableClasses = useMemo(
    () => (dashboardData?.shareableClasses ?? activeClasses).filter((c) => c.id && !isPendingPayment(c.status)),
    [activeClasses, dashboardData?.shareableClasses],
  );
  const todaysHistory = dashboardData?.todayHistory ?? [];

  // Primary class for hero (live > first active)
  const primaryClass: Enrollment = allClasses.find((c) => c.isLive) ??
    activeClasses[0] ?? {
      name: t("dashboard.noClass"),
      tutorName: "-",
      status: "none",
      nextSession: "-",
      progress: 0,
      bookName: null,
      seriesCefr: null,
    };

  const student = {
    name: profile?.displayName || t("dashboard.loadingName"),
    avatar: profile?.pictureUrl || null,
    initials: profile?.displayName?.charAt(0) || "TA",
    level: primaryClass.bookName || "Origins 1",
    cefr: primaryClass.seriesCefr || "A1",
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.morning");
    if (hour < 17) return t("dashboard.afternoon");
    return t("dashboard.evening");
  };

  /* ── Referral copy handler ── */
  const copyReferralForClass = async (classId?: string) => {
    if (copyState !== 'idle') return;
    setCopyState('loading');
    setCopyingClassId(classId ?? null);
    try {
      const data = await studentApi.generateShareLink(classId);
      // Use clipboard API with fallback for LINE WebView (WKWebView may not support it)
      try {
        await navigator.clipboard.writeText(data.url);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = data.url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setIsClassPickerOpen(false);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2500);
    } catch {
      setCopyState('idle');
    } finally {
      setCopyingClassId(null);
    }
  };

  const handleCopyReferral = async () => {
    if (copyState !== 'idle') return;
    if (shareableClasses.length > 1) {
      setIsClassPickerOpen(true);
      return;
    }
    await copyReferralForClass(shareableClasses[0]?.id);
  };

  /* ── Loading / Error ── */
  if (!isReady || loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertCircle className="text-rose-500 w-12 h-12" />
        <h2 className="text-xl font-bold text-foreground">{t("dashboard.loadFailed")}</h2>
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-bold text-sm"
        >
          {t("dashboard.retry")}
        </button>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div style={{ background: "var(--surface-bg)", minHeight: "100dvh" }}>

      {/* ── Header ── */}
      <header
        className="curved-bottom"
        style={{
          background: "linear-gradient(135deg, #06c755 0%, #049a42 50%, #037d36 100%)",
          padding: "20px 20px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div aria-hidden style={{ position: "absolute", bottom: 10, left: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8125rem", fontWeight: 500 }}>
              {getGreeting()}
            </p>
            <h1 style={{ color: "#fff", fontSize: "1.375rem", fontWeight: 800, marginTop: 2, letterSpacing: "-0.01em" }}>
              {student.name}
            </h1>
          </div>
          <Avatar className="w-14 h-14 border-[3px] border-white/40 shadow-lg">
            {student.avatar && <AvatarImage src={student.avatar} alt={student.name} className="object-cover" />}
            <AvatarFallback className="bg-white/20 text-white text-lg font-bold">{student.initials}</AvatarFallback>
          </Avatar>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", padding: "4px 12px", borderRadius: 14, fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", backdropFilter: "blur(4px)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", marginRight: 6 }} />
            {student.level} / {student.cefr}
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "4px 12px", borderRadius: 14, fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center" }}>
            <Flame size={14} style={{ marginRight: 6, color: "#fbbf24" }} />
            {dashboardData?.weekStreak || 0} {t("dashboard.weekStreakSuffix")}
          </div>
          {pendingClasses.length > 0 && (
            <div style={{ background: "rgba(251,191,36,0.25)", border: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24", padding: "4px 12px", borderRadius: 14, fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              <AlertTriangle size={12} />
              {t("dashboard.pendingBadgePrefix")} {pendingClasses.length} {t("dashboard.pendingBadgeSuffix")}
            </div>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <div style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: 20, marginTop: -8 }}>

        {/* ── Pending Payment Banner ── */}
        {pendingClasses.length > 0 && (
          <PendingPaymentBanner classes={pendingClasses} />
        )}

        {/* ── My Classes ── */}
        <section className="px-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-foreground">{t("dashboard.myClasses")}</h2>
              {(dashboardData?.activeEnrollments ?? 0) > 0 && (
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  {dashboardData?.activeEnrollments} {t("dashboard.classUnit")}
                </span>
              )}
            </div>
            <Link
              href="/classes"
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1.5 rounded-xl"
            >
              {t("dashboard.viewAll")} <ChevronRight size={13} />
            </Link>
          </div>

          {allClasses.length === 0 ? (
            /* Empty state */
            <div className="rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles size={24} className="text-indigo-500" />
              </div>
              <p className="font-bold text-foreground text-sm mb-1">{t("dashboard.noClasses")}</p>
              <p className="text-xs text-muted-foreground mb-4">{t("dashboard.noClassesSub")}</p>
              <Link href="/classes">
                <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold text-xs shadow-md">
                  {t("dashboard.findClass")}
                </button>
              </Link>
            </div>
          ) : allClasses.length === 1 ? (
            /* Single class — full width */
            <ClassCard enrollment={allClasses[0]} />
          ) : (
            /* Multiple classes — horizontal scroll */
            <div
              className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1"
              style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
            >
              {allClasses.map((cls, i) => (
                <div key={cls.id ?? i} style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
                  <ClassCard enrollment={cls} />
                </div>
              ))}
              {/* Browse more card */}
              <div style={{ scrollSnapAlign: "start", flexShrink: 0 }} className="min-w-[160px] max-w-[160px]">
                <Link href="/classes" className="block h-full">
                  <div className="h-full min-h-[180px] rounded-2xl border-2 border-dashed border-border bg-card flex flex-col items-center justify-center gap-2 p-4 text-center active:scale-95 transition-transform">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                      <Sparkles size={18} className="text-indigo-500" />
                    </div>
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{t("dashboard.findClass")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("dashboard.findClassSub")}</p>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ── Referral card ── */}
        <section className="px-4">
          <div className="glass-card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(6,199,85,0.12)", fontSize: "1.375rem" }}>
              🔗
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)", margin: 0 }}>{t("dashboard.shareTitle")}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "2px 0 0" }}>{t("dashboard.shareDescription")}</p>
            </div>
            <button
              id="btn-copy-referral"
              onClick={handleCopyReferral}
              disabled={copyState !== 'idle' || shareableClasses.length === 0}
              style={{
                flexShrink: 0,
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 12,
                border: "none",
                cursor: shareableClasses.length === 0 ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                background: copyState === 'copied'
                  ? "var(--brand-500)"
                  : "var(--neutral-100)",
                color: copyState === 'copied'
                  ? "white"
                  : "var(--text-primary)",
                opacity: copyState === 'loading' ? 0.6 : 1,
              }}
            >
              {copyState === 'loading'
                ? "..."
                : copyState === 'copied'
                ? t("dashboard.referralCopied")
                : shareableClasses.length > 1
                ? t("dashboard.selectClass")
                : t("dashboard.copyReferral")}
            </button>
          </div>
        </section>

        {/* ── Quick actions ── */}
        <section className="px-4">
          <h2 className="text-base font-black text-foreground mb-3">{t("dashboard.quickMenu")}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              {
                id: "quick-read",
                href: "/classes",
                Icon: Glasses,
                label: t("dashboard.findClass"),
                sub: t("dashboard.findClassSub"),
                bgColor: "var(--brand-50)",
                iconBg: "var(--brand-100)",
                iconColor: "var(--brand-600)",
              },
              {
                id: "quick-chat",
                href: "/chat",
                Icon: MessageCircle,
                label: t("dashboard.chatTutor"),
                sub: t("dashboard.chatTutorSub"),
                bgColor: "var(--accent-blue-light)",
                iconBg: "rgba(59, 130, 246, 0.15)",
                iconColor: "var(--accent-blue)",
              },
              {
                id: "quick-schedule",
                href: "/schedule",
                Icon: Calendar,
                label: t("dashboard.schedule"),
                sub: t("dashboard.scheduleSub"),
                bgColor: "var(--accent-purple-light)",
                iconBg: "rgba(139, 92, 246, 0.15)",
                iconColor: "var(--accent-purple)",
              },
              {
                id: "quick-payment",
                href: "/payment/history",
                Icon: CreditCard,
                label: t("dashboard.payment"),
                sub: t("dashboard.paymentSub"),
                bgColor: "var(--accent-amber-light)",
                iconBg: "rgba(245, 158, 11, 0.15)",
                iconColor: "var(--accent-amber)",
              },
            ].map((item) => (
              <Link
                key={item.id}
                id={item.id}
                href={item.href}
                className="block active:scale-[0.97]"
                style={{
                  background: item.bgColor,
                  border: "1px solid var(--surface-border)",
                  borderRadius: 18,
                  padding: "16px 14px",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  minHeight: 100,
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {item.id === "quick-chat" && (dashboardData?.unreadMessages ?? 0) > 0 && (
                  <div style={{ position: "absolute", top: 14, right: 14, background: "var(--accent-red)", color: "#fff", fontSize: "0.625rem", fontWeight: 800, padding: "2px 6px", borderRadius: 8, minWidth: 20, textAlign: "center", boxShadow: "0 2px 6px rgba(239, 68, 68, 0.3)" }}>
                    {(dashboardData?.unreadMessages ?? 0) > 99 ? "99+" : dashboardData?.unreadMessages}
                  </div>
                )}
                {item.id === "quick-payment" && pendingClasses.length > 0 && (
                  <div style={{ position: "absolute", top: 14, right: 14, background: "#f59e0b", color: "#fff", fontSize: "0.625rem", fontWeight: 800, padding: "2px 6px", borderRadius: 8, minWidth: 20, textAlign: "center" }}>
                    {pendingClasses.length}
                  </div>
                )}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <item.Icon size={18} style={{ color: item.iconColor }} />
                </div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>{item.label}</div>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: 2 }}>{item.sub}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Lesson History ── */}
        <section className="px-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-black text-foreground">{t("dashboard.todayHistory")}</h2>
            <Link
              href="/lesson/history"
              style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--brand-600)", display: "flex", alignItems: "center", gap: 2, padding: "4px 8px", background: "var(--brand-50)", borderRadius: 8 }}
            >
              {t("dashboard.viewHistory")} <ChevronRight size={14} />
            </Link>
          </div>

          {(() => {
            if (todaysHistory.length === 0) {
              return (
                <div
                  style={{ marginTop: 4, padding: "28px 20px", textAlign: "center", borderStyle: "dashed", borderColor: "var(--surface-border)", borderWidth: 1, borderRadius: 16, background: "rgba(var(--surface-card-rgb), 0.5)" }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>📚</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                    {t("dashboard.emptyTodayHistory")}
                  </div>
                </div>
              );
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                {todaysHistory.map((hist) => (
                  <Link
                    key={hist.sessionId}
                    href={`/lesson/history/${hist.sessionId}`}
                    className="glass-card clickable-effect"
                    style={{ textDecoration: "none", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}
                  >
                    <div style={{ width: 46, height: 46, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, background: hist.rank === 1 ? "rgba(245, 158, 11, 0.15)" : hist.rank === 2 ? "rgba(148, 163, 184, 0.15)" : "var(--neutral-100)", color: hist.rank === 1 ? "#d97706" : hist.rank === 2 ? "#475569" : "var(--text-secondary)" }}>
                      <span style={{ fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1 }}>RANK</span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 0.5, marginTop: 2 }}>
                        <span style={{ fontSize: "1.125rem", lineHeight: 1 }}>{hist.rank}</span>
                        {hist.totalParticipants > 0 && (
                          <span style={{ fontSize: "0.625rem", opacity: 0.6 }}>/{hist.totalParticipants}</span>
                        )}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {hist.articleTitle}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                        <span>{t("dashboard.tutorPrefix")} {hist.tutorName}</span>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor", opacity: 0.5 }} />
                        <span>
                          {new Date(hist.date).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} {t("dashboard.timeSuffix")}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(5, 150, 105, 0.1)", border: "1px solid rgba(5, 150, 105, 0.15)", color: "#059669", padding: "6px 10px", borderRadius: 10, minWidth: 44 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 800, lineHeight: 1 }}>{hist.score}</div>
                      <div style={{ fontSize: "0.5625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.9, marginTop: 3 }}>PTS</div>
                    </div>

                    <ChevronRight size={16} style={{ color: "var(--neutral-300)" }} />
                  </Link>
                ))}
              </div>
            );
          })()}
        </section>

        {/* bottom padding for nav */}
        <div style={{ height: 16 }} />
      </div>

      {isClassPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="referral-class-picker-title"
          className="fixed inset-0 z-50 flex items-end"
        >
          <button
            type="button"
            aria-label={t("app.close")}
            onClick={() => setIsClassPickerOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div className="relative w-full rounded-t-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div>
                <h2 id="referral-class-picker-title" className="text-base font-black text-foreground">
                  {t("dashboard.referralPickerTitle")}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("dashboard.referralPickerSubtitle")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("app.close")}
                onClick={() => setIsClassPickerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[55dvh] overflow-y-auto px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
              <div className="flex flex-col gap-2">
                {shareableClasses.map((cls) => {
                  const isCopyingThisClass = copyState === 'loading' && copyingClassId === cls.id;

                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => copyReferralForClass(cls.id)}
                      disabled={copyState !== 'idle'}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-60"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <BookOpen size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-foreground">{cls.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {cls.tutorName}
                          {cls.seriesCefr ? ` / ${cls.seriesCefr}` : ""}
                        </p>
                      </div>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                        {isCopyingThisClass ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                        ) : copyState === 'copied' && copyingClassId === cls.id ? (
                          <Check size={16} />
                        ) : (
                          <Copy size={16} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
