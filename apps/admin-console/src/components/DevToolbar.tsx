"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Terminal, X, ChevronUp, ChevronDown, RefreshCw, CheckCircle2,
  AlertTriangle, Zap, Trash2, Plus, Users, ReceiptText,
  ShieldAlert, FilePenLine, ExternalLink, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DevState {
  currentMonth: string;
  prevMonth: string;
  userCount: number;
  tutorCount: number;
  latestRun: { id: string; period: string; status: string } | null;
  pendingAdjustments: number;
  openFraudFlags: number;
}

type LogEntry = { id: number; type: "ok" | "err" | "info"; msg: string; ts: string };

async function devFetch(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method };
  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`/api/proxy${path}`, opts);
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data as any)?.error || JSON.stringify(data));
  return data;
}

export function DevToolbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DevState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  let logId = 0;

  const log = (type: LogEntry["type"], msg: string) => {
    const ts = new Date().toLocaleTimeString("th-TH");
    setLogs((prev) => [{ id: ++logId, type, msg, ts }, ...prev].slice(0, 30));
  };

  const loadState = useCallback(async () => {
    try {
      const data = await devFetch("GET", "/v1/dev/state");
      setState(data);
    } catch (e: any) {
      log("err", `State load: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    if (open) loadState();
  }, [open, loadState]);

  const run = async (key: string, label: string, fn: () => Promise<any>) => {
    setBusy(key);
    log("info", `▶ ${label}…`);
    try {
      const result = await fn();
      const msg = result?.message || result?.settlementRunId || result?.flag?.flagId
        || JSON.stringify(result).slice(0, 80);
      log("ok", `✓ ${label}: ${msg}`);
      await loadState();
      router.refresh();
    } catch (e: any) {
      log("err", `✗ ${label}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  // PAGE-SPECIFIC quick actions
  const pageActions: { key: string; label: string; icon: React.ReactNode; action: () => Promise<any> }[] = [];

  if (pathname === "/" || pathname.startsWith("/settlements")) {
    pageActions.push(
      {
        key: "settlement-current",
        label: `Settlement ${state?.currentMonth ?? "…"}`,
        icon: <ReceiptText className="h-3.5 w-3.5" />,
        action: () => devFetch("POST", "/v1/dev/actions/settlement", { periodMonth: state?.currentMonth }),
      },
      {
        key: "settlement-prev",
        label: `Settlement ${state?.prevMonth ?? "…"} (prev)`,
        icon: <ReceiptText className="h-3.5 w-3.5" />,
        action: () => devFetch("POST", "/v1/dev/actions/settlement", { periodMonth: state?.prevMonth }),
      },
    );
  }

  if (pathname.startsWith("/adjustments")) {
    pageActions.push({
      key: "adj-seed",
      label: "Create test adjustment (฿100)",
      icon: <FilePenLine className="h-3.5 w-3.5" />,
      action: () => devFetch("POST", "/v1/dev/actions/adjustment", { amountTHB: 100 }),
    });
  }

  if (pathname.startsWith("/fraud")) {
    pageActions.push({
      key: "fraud-seed",
      label: "Create fraud flag (HIGH)",
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      action: () => devFetch("POST", "/v1/dev/actions/fraud-flag", {}),
    });
  }

  // GLOBAL actions
  const globalActions = [
    {
      key: "settlement-current-g",
      label: `Run settlement ${state?.currentMonth ?? ""}`,
      icon: <ReceiptText className="h-3.5 w-3.5" />,
      action: () => devFetch("POST", "/v1/dev/actions/settlement", { periodMonth: state?.currentMonth }),
    },
    {
      key: "adj-seed-g",
      label: "Seed adjustment",
      icon: <FilePenLine className="h-3.5 w-3.5" />,
      action: () => devFetch("POST", "/v1/dev/actions/adjustment", {}),
    },
    {
      key: "fraud-seed-g",
      label: "Seed fraud flag",
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      action: () => devFetch("POST", "/v1/dev/actions/fraud-flag", {}),
    },
    {
      key: "purge-fraud",
      label: "Purge [DEV] fraud flags",
      icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
      action: () => devFetch("POST", "/v1/dev/actions/purge", { resource: "fraud" }),
    },
    {
      key: "purge-adj",
      label: "Purge DEV_TOOL adjustments",
      icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
      action: () => devFetch("POST", "/v1/dev/actions/purge", { resource: "adjustments" }),
    },
    {
      key: "purge-settlements",
      label: "Purge PENDING DEV settlements",
      icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
      action: () => devFetch("POST", "/v1/dev/actions/purge", { resource: "settlements" }),
    },
  ];

  // Floating button always visible in dev
  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[9999] flex items-center gap-1.5 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 px-3 py-2 text-xs font-bold hover:bg-orange-600 transition-all active:scale-95"
        title="Dev Toolbar"
      >
        <Terminal className="h-3.5 w-3.5" />
        DEV
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-16 right-5 z-[9998] w-[360px] max-h-[80vh] flex flex-col rounded-2xl border border-orange-500/30 bg-background shadow-2xl shadow-black/20 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-orange-500/10 border-b border-orange-500/20 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold text-foreground">Dev Toolbar</span>
              <Badge className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">DEV</Badge>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadState}
                className="p-1 rounded-lg hover:bg-orange-500/10 text-muted-foreground hover:text-orange-500 transition-colors"
                title="Refresh state"
              >
                <RefreshCw className="h-3.5 w-3.5" />
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
            {/* State snapshot */}
            {state && (
              <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">System State</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Users", value: state.userCount },
                    { label: "Tutors", value: state.tutorCount },
                    { label: "Pending adj.", value: state.pendingAdjustments },
                    { label: "Open fraud", value: state.openFraudFlags },
                    { label: "Latest run", value: state.latestRun?.period ?? "—" },
                    { label: "Run status", value: state.latestRun?.status ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-card rounded-lg p-2 border border-border/50">
                      <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
                      <p className="text-xs font-bold text-foreground truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Page-specific actions */}
            {pageActions.length > 0 && (
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Page Actions
                </p>
                <div className="space-y-1.5">
                  {pageActions.map((a) => (
                    <ActionBtn key={a.key} {...a} busy={busy} onRun={(k, l, fn) => run(k, l, fn)} />
                  ))}
                </div>
              </div>
            )}

            {/* Global actions */}
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Global Actions</p>
              <div className="space-y-1.5">
                {globalActions.map((a) => (
                  <ActionBtn key={a.key} {...a} busy={busy} onRun={(k, l, fn) => run(k, l, fn)} />
                ))}
              </div>
            </div>

            {/* Quick nav */}
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Quick Nav</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { href: "/dev", label: "User CRUD", icon: <Users className="h-3 w-3" /> },
                  { href: "/settlements", label: "Settlements", icon: <ReceiptText className="h-3 w-3" /> },
                  { href: "/adjustments", label: "Adjustments", icon: <FilePenLine className="h-3 w-3" /> },
                  { href: "/fraud", label: "Fraud", icon: <ShieldAlert className="h-3 w-3" /> },
                ].map(({ href, label, icon }) => (
                  <a
                    key={href}
                    href={href}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-muted hover:bg-muted/80 text-foreground border border-border/50 transition-colors"
                  >
                    {icon} {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Log */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Log</p>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-[9px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              {logs.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">No actions yet</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {logs.map((l) => (
                    <div key={l.id} className="flex gap-2 text-[10px] font-mono">
                      <span className="text-muted-foreground shrink-0">{l.ts}</span>
                      <span className={
                        l.type === "ok" ? "text-emerald-600" :
                        l.type === "err" ? "text-red-500" : "text-muted-foreground"
                      }>
                        {l.msg}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ActionBtn({
  key: _key,
  label,
  icon,
  action,
  busy,
  onRun,
}: {
  key: string;
  label: string;
  icon: React.ReactNode;
  action: () => Promise<any>;
  busy: string | null;
  onRun: (key: string, label: string, fn: () => Promise<any>) => void;
}) {
  const myKey = label; // use label as unique key for busy state
  const isBusy = busy === myKey;
  return (
    <button
      onClick={() => onRun(myKey, label, action)}
      disabled={busy !== null}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-card border border-border/60 hover:border-orange-500/50 hover:bg-orange-500/5 text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
    >
      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : <span className="shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </button>
  );
}
