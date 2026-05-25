"use client";

import { useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Terminal, X, RefreshCw, ChevronUp, ChevronDown,
  Copy, Check, AlertTriangle, Loader2, User,
  Wallet, Star, MessageCircle, BookOpen,
  LayoutDashboard, Calendar, Network, Settings,
  GraduationCap, TrendingUp, Clock, Zap, PlusCircle, Trash2,
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
  sponsorTutorId: string | null;
}

interface DevEarnings {
  periodMonth: string;
  currentProjection: {
    directSales: number;
    networkBonus: number;
    clawback: number;
    total: number;
  };
  rateInfo: {
    rate: number;
    volume: number;
    nextTarget: number;
  };
  history: Array<{
    date: string;
    direct: number;
    network: number;
    badgeBonus?: number;
    clawback: number;
    withholdingTax?: number;
    netPayout?: number;
    status: string;
  }>;
}

interface DevNotifications {
  unreadChat: number;
  availableAuctions: number;
}

interface DevState {
  user: DevUser | null;
  earnings: DevEarnings | null;
  notifications: DevNotifications | null;
  badges: string[];
  tokenMasked: string | null;
  tokenExp: number | null;
  tokenExpiresInSec: number | null;
  tokenRole: string | null;
  tokenSub: string | null;
}

type LogEntry = { id: number; type: "ok" | "err" | "info"; msg: string; ts: string };

// ─── Badge config ─────────────────────────────────────────────────────────────

const BADGES = [
  { code: "ELITE_EDUCATOR",  label: "Elite",   bonusTHB: 500 },
  { code: "TOP_RATED",       label: "Top",     bonusTHB: 300 },
  { code: "CLASS_MASTER",    label: "Master",  bonusTHB: 200 },
  { code: "NETWORK_BUILDER", label: "Network", bonusTHB: 100 },
  { code: "RISING_STAR",     label: "Rising",  bonusTHB:  50 },
  { code: "FAST_RESPONDER",  label: "Fast",    bonusTHB:  50 },
  { code: "AI_PIONEER",      label: "AI",      bonusTHB:  50 },
] as const;

const VOLUME_PRESETS = [500, 1000, 5000, 10000, 50000] as const;

// ─── Quick nav pages ──────────────────────────────────────────────────────────

const NAV_PAGES = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/earnings", label: "Earnings", icon: Wallet },
  { href: "/dashboard/classes", label: "Classes", icon: GraduationCap },
  { href: "/dashboard/schedule", label: "Schedule", icon: Calendar },
  { href: "/dashboard/network", label: "Network", icon: Network },
  { href: "/dashboard/performance", label: "Performance", icon: TrendingUp },
  { href: "/dashboard/chat", label: "Chat", icon: MessageCircle },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTHB(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

function formatExpiry(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds <= 0) return "หมดอายุแล้ว";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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
  const [customVolume, setCustomVolume] = useState("");
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
      log("ok", `โหลด state สำเร็จ — ${data.user?.displayName ?? "ไม่มีชื่อ"}`);
    } catch (e: unknown) {
      log("err", `โหลด state ล้มเหลว: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const runAction = useCallback(async (
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any,
    successMsg: string,
  ) => {
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
      // Reload state to reflect changes
      await loadState();
    } catch (e: unknown) {
      log("err", `action ล้มเหลว: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionLoading(null);
    }
  }, [loadState]);

  const addVolume = (amountTHB: number) =>
    runAction(`vol_${amountTHB}`, { action: "addVolume", amountTHB }, `+฿${amountTHB.toLocaleString()} volume เพิ่มแล้ว`);

  const toggleBadge = (badgeCode: string) =>
    runAction(`badge_${badgeCode}`, { action: "toggleBadge", badgeCode }, `Badge ${badgeCode} toggled`);

  const clearVolume = () =>
    runAction("clearVol", { action: "clearVolume" }, "ล้าง DEV volume แล้ว");

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !state) loadState();
  };

  const { user, earnings, notifications } = state ?? {};
  const projection = earnings?.currentProjection;
  const rateInfo = earnings?.rateInfo;
  const commissionPct = rateInfo ? Math.round(rateInfo.rate * 100) : null;

  // Token expiry colour
  const expSec = state?.tokenExpiresInSec ?? null;
  const expClass =
    expSec === null ? "text-muted-foreground"
    : expSec <= 0   ? "text-red-500 font-bold"
    : expSec < 300  ? "text-amber-500 font-bold"
    : "text-emerald-500";

  return (
    <>
      {/* ── Floating toggle button ───────────────────────────────────────── */}
      <button
        onClick={handleOpen}
        className="fixed bottom-24 right-4 z-[9999] flex items-center gap-1.5 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 px-3 py-2 text-xs font-bold hover:bg-orange-600 active:scale-95 transition-all lg:bottom-5 lg:right-5"
        title="Dev Toolbar"
      >
        <Terminal className="h-3.5 w-3.5" />
        DEV
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-36 right-4 z-[9998] w-[340px] max-h-[75vh] flex flex-col rounded-2xl border border-orange-500/30 bg-background shadow-2xl shadow-black/20 overflow-hidden lg:bottom-16 lg:right-5">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-orange-500/10 border-b border-orange-500/20 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold text-foreground">Dev Panel</span>
              <Badge className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                DEV
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
                className="p-1 rounded-lg hover:bg-orange-500/10 text-muted-foreground hover:text-orange-500 transition-colors disabled:opacity-50"
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
                      {user.displayName ?? <span className="italic text-muted-foreground">ไม่มีชื่อ</span>}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                        user.verificationStatus === "VERIFIED"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : user.verificationStatus === "PENDING"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : "bg-red-500/10 text-red-500 border-red-500/30"
                      }`}>
                        {user.verificationStatus}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{user.email ?? "—"}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      {user.userId.slice(0, 8)}…
                    </span>
                    <CopyBtn text={user.userId} />
                    {user.sponsorTutorId && (
                      <span className="text-[10px] text-brand-500 font-medium">
                        Sponsor: {user.sponsorTutorId.slice(0, 8)}…
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
                  {state.tokenMasked && (
                    <CopyBtn text={state.tokenMasked} />
                  )}
                </div>
              </div>
            )}

            {/* ── Earnings projection ───────────────────────────────── */}
            {projection && rateInfo && (
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Earnings — {earnings?.periodMonth}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Commission", value: formatTHB(projection.directSales) },
                    { label: "Network Bonus", value: formatTHB(projection.networkBonus) },
                    { label: "Clawback", value: formatTHB(projection.clawback) },
                    { label: "Total (Gross)", value: formatTHB(projection.total) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-card rounded-lg p-2 border border-border/50">
                      <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
                      <p className="text-xs font-bold text-foreground truncate">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { label: "Rate", value: `${commissionPct}%` },
                    { label: "Volume", value: formatTHB(rateInfo.volume) },
                    { label: "Next Target", value: rateInfo.nextTarget > 0 ? formatTHB(rateInfo.nextTarget) : "Max" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-card rounded-lg p-2 border border-brand-500/20">
                      <p className="text-[9px] text-brand-600 dark:text-brand-400 font-medium">{label}</p>
                      <p className="text-xs font-bold text-foreground truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Payout history preview ────────────────────────────── */}
            {earnings?.history && earnings.history.length > 0 && (
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> ประวัติ 3 รอบล่าสุด
                </p>
                <div className="space-y-1.5">
                  {earnings.history.slice(0, 3).map((item) => {
                    const net = item.netPayout ?? (item.direct + item.network + item.clawback);
                    return (
                      <div
                        key={item.date}
                        className="flex items-center justify-between bg-card border border-border/50 rounded-lg px-3 py-2"
                      >
                        <div>
                          <p className="text-[10px] font-bold text-foreground">{item.date}</p>
                          <p className="text-[9px] text-muted-foreground uppercase">{item.status}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-foreground">{formatTHB(net)}</p>
                          {item.withholdingTax !== undefined && item.withholdingTax > 0 && (
                            <p className="text-[9px] text-muted-foreground">
                              WHT: -{formatTHB(item.withholdingTax)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Notifications ─────────────────────────────────────── */}
            {notifications && (
              <div className="px-4 py-2.5 border-b border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Star className="h-3 w-3" /> Notifications
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-card rounded-lg p-2 border border-border/50">
                    <p className="text-[9px] text-muted-foreground">Unread Chat</p>
                    <p className="text-sm font-black text-foreground">{notifications.unreadChat}</p>
                  </div>
                  <div className="bg-card rounded-lg p-2 border border-border/50">
                    <p className="text-[9px] text-muted-foreground">Auctions</p>
                    <p className="text-sm font-black text-foreground">{notifications.availableAuctions}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Current page ──────────────────────────────────────── */}
            <div className="px-4 py-2.5 border-b border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Current Path
              </p>
              <code className="text-[11px] font-mono text-brand-500 bg-brand-500/5 px-2 py-1 rounded-lg block">
                {pathname}
              </code>
            </div>

            {/* ── Simulate ─────────────────────────────────────────── */}
            <div className="px-4 py-3 border-b border-border/50 bg-orange-500/3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Simulate
              </p>

              {/* Volume */}
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Volume — Rate {earnings ? Math.round(earnings.rateInfo.rate * 100) : "—"}%
                {earnings?.rateInfo.nextTarget ? ` · next ฿${earnings.rateInfo.nextTarget.toLocaleString()}` : " · max"}
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                {VOLUME_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => addVolume(amt)}
                    disabled={actionLoading !== null}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === `vol_${amt}` ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin inline" />
                    ) : (
                      `+฿${amt >= 1000 ? `${amt / 1000}K` : amt}`
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  placeholder="Custom ฿"
                  value={customVolume}
                  onChange={(e) => setCustomVolume(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 text-[10px] rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={() => {
                    const v = Number(customVolume);
                    if (v > 0) { addVolume(v); setCustomVolume(""); }
                  }}
                  disabled={!customVolume || Number(customVolume) <= 0 || actionLoading !== null}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 flex items-center gap-0.5 transition-colors"
                >
                  <PlusCircle className="h-3 w-3" />
                  เพิ่ม
                </button>
                <button
                  onClick={clearVolume}
                  disabled={actionLoading !== null}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-0.5 transition-colors"
                  title="ล้าง DEV payments ทั้งหมด"
                >
                  {actionLoading === "clearVol" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>

              {/* Badges */}
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-3 mb-1.5">
                Badges
              </p>
              <div className="flex flex-wrap gap-1">
                {BADGES.map(({ code, label, bonusTHB }) => {
                  const active = (state?.badges ?? []).includes(code);
                  const isLoading = actionLoading === `badge_${code}`;
                  return (
                    <button
                      key={code}
                      onClick={() => toggleBadge(code)}
                      disabled={actionLoading !== null}
                      title={`${code} +฿${bonusTHB}`}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors disabled:opacity-50 flex items-center gap-0.5 ${
                        active
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          : "bg-muted text-muted-foreground border-border/40 hover:border-amber-500/30 hover:text-amber-600"
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <Star className={`h-2.5 w-2.5 ${active ? "fill-amber-400" : ""}`} />
                      )}
                      {label}
                      <span className={`text-[8px] ${active ? "text-amber-600" : "text-muted-foreground/60"}`}>
                        +{bonusTHB}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Nav shortcuts ──────────────────────────────────────── */}
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Navigate
              </p>
              <div className="flex flex-wrap gap-1.5">
                {NAV_PAGES.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                  return (
                    <a
                      key={href}
                      href={href}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        isActive
                          ? "bg-brand-500/10 border-brand-500/40 text-brand-600 dark:text-brand-400"
                          : "bg-muted hover:bg-muted/80 text-foreground border-border/50"
                      }`}
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {label}
                    </a>
                  );
                })}
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

            {/* ── Warning strip ─────────────────────────────────────── */}
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
