"use client";

import { useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Terminal, X, RefreshCw, ChevronUp, ChevronDown,
  Copy, Check, AlertTriangle, Loader2, User,
  Wallet, MessageCircle, BookOpen, Calendar,
  LayoutDashboard, Settings, Clock, Zap,
  CreditCard, TrendingUp, History, GraduationCap,
  LogOut, Flame, Trash2, PlusCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DevUser {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: string;
  verificationStatus: string;
  isActive: boolean;
}

interface DevDashboard {
  unreadMessages?: number;
  weekStreak?: number;
  activeEnrollments?: number;
  recentClasses?: Array<{
    id?: string;
    name: string;
    status: string;
    tutorName: string;
    isLive?: boolean;
  }>;
}

interface DevPayment {
  paymentIntentId?: string;
  id?: string;
  amountSatang?: number;
  amount?: number;
  status?: string;
  createdAt?: string;
  className?: string;
}

interface DevNotifications {
  unreadChat?: number;
  availableAuctions?: number;
}

interface DevState {
  user: DevUser | null;
  studentUserId: string | null;
  dashboard: DevDashboard | null;
  recentPayments: DevPayment[];
  notifications: DevNotifications | null;
  tokenMasked: string | null;
  tokenRaw: string | null;
  tokenExp: number | null;
  tokenExpiresInSec: number | null;
  tokenRole: string | null;
  tokenSub: string | null;
  lineUserId: string | null;
}

type LogEntry = { id: number; type: "ok" | "err" | "info"; msg: string; ts: string };

// ─── Quick nav pages ──────────────────────────────────────────────────────────

const NAV_PAGES = [
  { href: "/dashboard",          label: "Home",        icon: LayoutDashboard },
  { href: "/classes",            label: "Classes",     icon: GraduationCap },
  { href: "/payment/history",    label: "Payments",    icon: CreditCard },
  { href: "/profile",            label: "Profile",     icon: User },
  { href: "/progress",           label: "Progress",    icon: TrendingUp },
  { href: "/schedule",           label: "Schedule",    icon: Calendar },
  { href: "/chat",               label: "Chat",        icon: MessageCircle },
  { href: "/lesson/history",     label: "History",     icon: History },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTHB(satang: number | undefined, isSatang = true) {
  if (satang === undefined || satang === null) return "—";
  const thb = isSatang ? satang / 100 : satang;
  return thb.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

function formatExpiry(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds <= 0) return "หมดอายุ";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function paymentStatusColor(status?: string) {
  const s = status?.toLowerCase() ?? "";
  if (s === "paid" || s === "completed" || s === "success") return "text-emerald-600";
  if (s.includes("pending") || s === "awaiting_payment") return "text-amber-500";
  if (s === "failed" || s === "expired") return "text-red-500";
  return "text-muted-foreground";
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
      title="คัดลอก"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DevToolbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DevState | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  const log = (type: LogEntry["type"], msg: string) => {
    const ts = new Date().toLocaleTimeString("th-TH");
    setLogs((prev) =>
      [{ id: ++logIdRef.current, type, msg, ts }, ...prev].slice(0, 30),
    );
  };

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dev/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data: DevState = await res.json();
      setState(data);
      log("ok", `โหลด state — ${data.user?.displayName ?? "ไม่มีชื่อ"}`);
    } catch (e: unknown) {
      log("err", `โหลดล้มเหลว: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const runAction = useCallback(
    async (key: string, body: unknown, successMsg: string) => {
      setActionLoading(key);
      try {
        const res = await fetch("/api/dev/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        log("ok", successMsg);
        await loadState();
      } catch (e: unknown) {
        log("err", `action ล้มเหลว: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setActionLoading(null);
      }
    },
    [loadState],
  );

  const confirmPayment = (paymentIntentId: string) =>
    runAction(
      `pay_${paymentIntentId}`,
      { action: "confirmPayment", paymentIntentId },
      `Payment ${paymentIntentId.slice(0, 8)}… confirmed`,
    );

  const confirmAllPending = () =>
    runAction("confirmAll", { action: "confirmAllPending" }, "Confirmed all pending payments");

  const seedLessonHistory = () =>
    runAction("seedHistory", { action: "seedLessonHistory" }, "Seeded lesson history ✓");

  const purgeLessonHistory = () =>
    runAction("purgeHistory", { action: "purgeLessonHistory" }, "Lesson history purged");

  const seedFullProgress = () =>
    runAction("seedFullProgress", { action: "seedFullProgress" }, "Full progress seeded — all articles completed ✓");

  const activateEnrollments = () =>
    runAction("activateEnroll", { action: "activateEnrollments" }, "Enrollments activated ✓");

  const clearSession = () =>
    runAction("clearSession", { action: "clearSession" }, "Session cleared — กำลัง redirect…").then(
      () => setTimeout(() => (window.location.href = "/login"), 500),
    );

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !state) loadState();
  };

  const { user, dashboard, recentPayments, notifications } = state ?? {};

  // Token expiry colour
  const expSec = state?.tokenExpiresInSec ?? null;
  const expClass =
    expSec === null ? "text-muted-foreground"
    : expSec <= 0   ? "text-red-500 font-bold"
    : expSec < 300  ? "text-amber-500 font-bold"
    : "text-emerald-500";

  // Pending payments from recentPayments
  const pendingPayments = (recentPayments ?? []).filter(
    (p) =>
      p.status?.toLowerCase().includes("pending") ||
      p.status === "AWAITING_PAYMENT",
  );

  return (
    <>
      {/* ── Floating toggle button ───────────────────────────────────────── */}
      <button
        onClick={handleOpen}
        className="fixed bottom-24 right-4 z-[9999] flex items-center gap-1.5 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 px-3 py-2 text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all lg:bottom-5 lg:right-5"
        title="Dev Toolbar"
      >
        <Terminal className="h-3.5 w-3.5" />
        DEV
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-36 right-4 z-[9998] w-[340px] max-h-[75vh] flex flex-col rounded-2xl border border-emerald-500/30 bg-background shadow-2xl shadow-black/20 overflow-hidden lg:bottom-16 lg:right-5">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-bold text-foreground">Dev Panel</span>
              <Badge className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                STUDENT
              </Badge>
              {state?.tokenExpiresInSec !== undefined && (
                <span className={`text-[10px] font-mono ${expClass}`}>
                  <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                  {formatExpiry(state.tokenExpiresInSec)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadState}
                disabled={loading}
                className="p-1 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* ── User info ────────────────────────────────────────────── */}
            {user && (
              <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <User className="h-3 w-3" /> ผู้ใช้ปัจจุบัน
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      {user.displayName ?? (
                        <span className="italic text-muted-foreground">ไม่มีชื่อ</span>
                      )}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                        user.verificationStatus === "VERIFIED"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : user.verificationStatus === "PENDING"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : "bg-red-500/10 text-red-500 border-red-500/30"
                      }`}
                    >
                      {user.verificationStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{user.email ?? "—"}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      {user.userId.slice(0, 8)}…
                    </span>
                    <CopyBtn text={user.userId} />
                    {state?.lineUserId && (
                      <span className="text-[10px] text-emerald-600 font-medium">
                        LINE: {state.lineUserId.slice(0, 8)}…
                        <CopyBtn text={state.lineUserId} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Session token ──────────────────────────────────────── */}
            {state?.tokenMasked && (
              <div className="px-4 py-2.5 border-b border-border/50 bg-muted/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  JWT Session
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground break-all flex-1">
                    {state.tokenMasked}
                  </span>
                  {state.tokenRaw && <CopyBtn text={state.tokenRaw} />}
                </div>
              </div>
            )}

            {/* ── Dashboard stats ───────────────────────────────────── */}
            {dashboard && (
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <LayoutDashboard className="h-3 w-3" /> Dashboard
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "Enrollments",
                      value: dashboard.activeEnrollments ?? 0,
                      icon: GraduationCap,
                    },
                    {
                      label: "Week Streak",
                      value: `${dashboard.weekStreak ?? 0}`,
                      icon: Flame,
                    },
                    {
                      label: "Unread",
                      value: dashboard.unreadMessages ?? 0,
                      icon: MessageCircle,
                    },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-card rounded-lg p-2 border border-border/50">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                        <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
                      </div>
                      <p className="text-sm font-black text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Classes list */}
                {(dashboard.recentClasses?.length ?? 0) > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {dashboard.recentClasses!.slice(0, 3).map((cls, i) => (
                      <div
                        key={cls.id ?? i}
                        className="flex items-center justify-between bg-card border border-border/50 rounded-lg px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-foreground truncate">
                            {cls.name}
                          </p>
                          <p className="text-[9px] text-muted-foreground">{cls.tutorName}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {cls.isLive && (
                            <span className="flex items-center gap-0.5 text-[8px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                              <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                              LIVE
                            </span>
                          )}
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              cls.status?.toLowerCase().includes("active")
                                ? "bg-emerald-500/10 text-emerald-600"
                                : cls.status?.toLowerCase().includes("pending")
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {cls.status?.toLowerCase().includes("pending")
                              ? "PENDING"
                              : cls.status?.toLowerCase().includes("active")
                              ? "ACTIVE"
                              : cls.status?.slice(0, 7)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Recent payments ───────────────────────────────────── */}
            {(recentPayments?.length ?? 0) > 0 && (
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Payments (ล่าสุด)
                </p>
                <div className="space-y-1.5">
                  {recentPayments!.map((p, i) => {
                    const id = p.paymentIntentId ?? p.id ?? "";
                    const amount = p.amountSatang ?? (p.amount ? p.amount * 100 : undefined);
                    return (
                      <div
                        key={id || i}
                        className="flex items-center justify-between bg-card border border-border/50 rounded-lg px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-foreground truncate">
                            {p.className ?? id.slice(0, 12) + "…"}
                          </p>
                          <p
                            className={`text-[9px] font-bold uppercase ${paymentStatusColor(p.status)}`}
                          >
                            {p.status}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-xs font-black text-foreground">
                            {formatTHB(amount)}
                          </span>
                          {(p.status?.toLowerCase().includes("pending") ||
                            p.status === "AWAITING_PAYMENT") && (
                            <button
                              onClick={() => confirmPayment(id)}
                              disabled={actionLoading !== null}
                              title="Confirm mock payment"
                              className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === `pay_${id}` ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                "✓ Pay"
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Simulate ─────────────────────────────────────────── */}
            <div className="px-4 py-3 border-b border-border/50 bg-emerald-500/3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Simulate
              </p>

              {/* Enrollment */}
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Enrollment
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={activateEnrollments}
                  disabled={actionLoading !== null}
                  title="Marks all PENDING_PAYMENT enrollments → ACTIVE"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
                >
                  {actionLoading === "activateEnroll" ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <GraduationCap className="h-3 w-3" />
                  )}
                  Activate enrollments
                </button>
              </div>

              {/* Lesson history & progress */}
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Lesson history &amp; progress
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={seedFullProgress}
                  disabled={actionLoading !== null}
                  title="Seeds FINISHED sessions for ALL book articles — progress hits 100% and streak builds"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 disabled:opacity-40 transition-colors"
                >
                  {actionLoading === "seedFullProgress" ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  Complete all lessons
                </button>

                <button
                  onClick={seedLessonHistory}
                  disabled={actionLoading !== null}
                  title="Creates FINISHED sessions from enrolled class articles (up to 5)"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 disabled:opacity-40 transition-colors"
                >
                  {actionLoading === "seedHistory" ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <PlusCircle className="h-3 w-3" />
                  )}
                  Seed 5 lessons
                </button>

                <button
                  onClick={purgeLessonHistory}
                  disabled={actionLoading !== null}
                  title="Deletes all FINISHED sessions the student participated in"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === "purgeHistory" ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Purge history
                </button>

                <a
                  href="/lesson/history"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-muted text-foreground border border-border/50 hover:bg-muted/80 transition-colors"
                >
                  <History className="h-3 w-3" />
                  View history
                </a>

                <a
                  href="/progress"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-muted text-foreground border border-border/50 hover:bg-muted/80 transition-colors"
                >
                  <TrendingUp className="h-3 w-3" />
                  View progress
                </a>
              </div>

              {/* Payment */}
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Payment
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={confirmAllPending}
                  disabled={actionLoading !== null || pendingPayments.length === 0}
                  title="Mock-confirms all PENDING payments via finance service"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
                >
                  {actionLoading === "confirmAll" ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <CreditCard className="h-3 w-3" />
                  )}
                  Confirm all pending
                  {pendingPayments.length > 0 && (
                    <span className="bg-amber-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full">
                      {pendingPayments.length}
                    </span>
                  )}
                </button>

                <a
                  href="/payment"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-muted text-foreground border border-border/50 hover:bg-muted/80 transition-colors"
                >
                  <CreditCard className="h-3 w-3" />
                  Payment page
                </a>
              </div>

              {/* Session */}
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Session
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={clearSession}
                  disabled={actionLoading === "clearSession"}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === "clearSession" ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <LogOut className="h-3 w-3" />
                  )}
                  Clear session
                </button>

                <a
                  href="/interactive/join"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-muted text-foreground border border-border/50 hover:bg-muted/80 transition-colors"
                >
                  <BookOpen className="h-3 w-3" />
                  Join lesson
                </a>

              </div>
            </div>

            {/* ── Current path ──────────────────────────────────────── */}
            <div className="px-4 py-2.5 border-b border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Current Path
              </p>
              <code className="text-[11px] font-mono text-emerald-600 bg-emerald-500/5 px-2 py-1 rounded-lg block">
                {pathname}
              </code>
            </div>

            {/* ── Nav shortcuts ──────────────────────────────────────── */}
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Navigate
              </p>
              <div className="flex flex-wrap gap-1.5">
                {NAV_PAGES.map(({ href, label, icon: Icon }) => {
                  const isActive =
                    pathname === href ||
                    (href !== "/dashboard" && pathname.startsWith(href));
                  return (
                    <a
                      key={href}
                      href={href}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        isActive
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted hover:bg-muted/80 text-foreground border-border/50"
                      }`}
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {label}
                    </a>
                  );
                })}

                <a
                  href="/login"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border bg-muted hover:bg-muted/80 text-foreground border-border/50 transition-colors"
                >
                  <Settings className="h-2.5 w-2.5" />
                  Login
                </a>
              </div>
            </div>

            {/* ── Log ───────────────────────────────────────────────── */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Log
                </p>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-[9px] text-muted-foreground hover:text-foreground"
                  >
                    ล้าง
                  </button>
                )}
              </div>
              {logs.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">ยังไม่มี log</p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {logs.map((l) => (
                    <div key={l.id} className="flex gap-2 text-[10px] font-mono">
                      <span className="text-muted-foreground shrink-0">{l.ts}</span>
                      <span
                        className={
                          l.type === "ok"
                            ? "text-emerald-600"
                            : l.type === "err"
                            ? "text-red-500"
                            : "text-muted-foreground"
                        }
                      >
                        {l.msg}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Status strips ─────────────────────────────────────── */}
            {!state && !loading && (
              <div className="px-4 py-3 flex items-center gap-2 text-amber-600 bg-amber-500/5 border-t border-amber-500/20">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <p className="text-[10px] font-medium">ไม่มี session หรือโหลดล้มเหลว</p>
              </div>
            )}
            {loading && (
              <div className="px-4 py-3 flex items-center gap-2 text-muted-foreground border-t border-border/30">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <p className="text-[10px]">กำลังโหลด…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
