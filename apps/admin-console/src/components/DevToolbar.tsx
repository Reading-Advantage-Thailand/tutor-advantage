"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Terminal, X, ChevronUp, ChevronDown, RefreshCw,
  Zap, Trash2, Users, ReceiptText,
  ShieldAlert, FilePenLine, Loader2, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { fetchWithAuth } from "@/lib/api";

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

function devFetch(method: string, path: string, body?: unknown) {
  return fetchWithAuth(path, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function DevToolbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DevState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const logIdRef = useRef(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const log = (type: LogEntry["type"], msg: string) => {
    const ts = new Date().toLocaleTimeString("th-TH");
    setLogs((prev) => [{ id: ++logIdRef.current, type, msg, ts }, ...prev].slice(0, 30));
  };

  const loadState = useCallback(async () => {
    try {
      const data = await devFetch("GET", "/v1/dev/state");
      setState(data);
    } catch (e: any) {
      log("err", `โหลด state ไม่ได้: ${e.message}`);
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

  // ACTION เฉพาะหน้า
  const pageActions: { id: string; label: string; icon: React.ReactNode; action: () => Promise<any> }[] = [];

  if (pathname === "/" || pathname.startsWith("/settlements")) {
    pageActions.push(
      {
        id: "settlement-current",
        label: `รัน Settlement ${state?.currentMonth ?? "…"}`,
        icon: <ReceiptText className="h-3.5 w-3.5" />,
        action: () => devFetch("POST", "/v1/dev/actions/settlement", { periodMonth: state?.currentMonth }),
      },
      {
        id: "settlement-prev",
        label: `รัน Settlement ${state?.prevMonth ?? "…"} (เดือนก่อน)`,
        icon: <ReceiptText className="h-3.5 w-3.5" />,
        action: () => devFetch("POST", "/v1/dev/actions/settlement", { periodMonth: state?.prevMonth }),
      },
    );
  }

  if (pathname.startsWith("/adjustments")) {
    pageActions.push({
      id: "adj-seed",
      label: "สร้าง adjustment ทดสอบ (฿100)",
      icon: <FilePenLine className="h-3.5 w-3.5" />,
      action: () => devFetch("POST", "/v1/dev/actions/adjustment", { amountTHB: 100 }),
    });
  }

  if (pathname.startsWith("/fraud")) {
    pageActions.push({
      id: "fraud-seed",
      label: "สร้าง fraud flag (HIGH)",
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      action: () => devFetch("POST", "/v1/dev/actions/fraud-flag", {}),
    });
  }

  // ACTION ทั่วไป — ไม่รวม purge-all-settlements (มี dialog confirm แยก)
  // กรอง action ที่ซ้ำกับ pageActions ออก (เช่น settlement บน /settlements page)
  const pageActionIds = new Set(pageActions.map((a) => a.id));
  const globalActions = [
    {
      id: "settlement-current-g",
      label: `รัน Settlement ${state?.currentMonth ?? ""}`,
      icon: <ReceiptText className="h-3.5 w-3.5" />,
      action: () => devFetch("POST", "/v1/dev/actions/settlement", { periodMonth: state?.currentMonth }),
    },
    {
      id: "adj-seed-g",
      label: "สร้าง adjustment ทดสอบ",
      icon: <FilePenLine className="h-3.5 w-3.5" />,
      action: () => devFetch("POST", "/v1/dev/actions/adjustment", {}),
    },
    {
      id: "fraud-seed-g",
      label: "สร้าง fraud flag ทดสอบ",
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      action: () => devFetch("POST", "/v1/dev/actions/fraud-flag", {}),
    },
    {
      id: "purge-fraud",
      label: "ลบ fraud flag [DEV] ทั้งหมด",
      icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
      action: () => devFetch("POST", "/v1/dev/actions/purge", { resource: "fraud" }),
    },
    {
      id: "purge-adj",
      label: "ลบ adjustment DEV_TOOL ทั้งหมด",
      icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
      action: () => devFetch("POST", "/v1/dev/actions/purge", { resource: "adjustments" }),
    },
    {
      id: "purge-settlements",
      label: "ลบ settlement PENDING (DEV) ทั้งหมด",
      icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
      action: () => devFetch("POST", "/v1/dev/actions/purge", { resource: "settlements" }),
    },
  ].filter((ga) => !pageActionIds.has(ga.id.replace(/-g$/, "")));

  return (
    <>
      {/* ปุ่มลอย */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[9999] flex items-center gap-1.5 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 px-3 py-2 text-xs font-bold hover:bg-orange-600 transition-all active:scale-95"
        title="Dev Toolbar"
      >
        <Terminal className="h-3.5 w-3.5" />
        DEV
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {/* แผง */}
      {open && (
        <div className="fixed bottom-16 right-5 z-[9998] w-[360px] max-h-[80vh] flex flex-col rounded-2xl border border-orange-500/30 bg-background shadow-2xl shadow-black/20 overflow-hidden">
          {/* หัว */}
          <div className="flex items-center justify-between px-4 py-3 bg-orange-500/10 border-b border-orange-500/20 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold text-foreground">เครื่องมือ Dev</span>
              <Badge className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">DEV</Badge>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadState}
                className="p-1 rounded-lg hover:bg-orange-500/10 text-muted-foreground hover:text-orange-500 transition-colors"
                title="รีเฟรช"
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
            {/* สถานะระบบ */}
            {state && (
              <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">สถานะระบบ</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "ผู้ใช้", value: state.userCount },
                    { label: "ครูพิเศษ", value: state.tutorCount },
                    { label: "Adj. รอ", value: state.pendingAdjustments },
                    { label: "Fraud เปิด", value: state.openFraudFlags },
                    { label: "Run ล่าสุด", value: state.latestRun?.period ?? "—" },
                    { label: "สถานะ Run", value: state.latestRun?.status ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-card rounded-lg p-2 border border-border/50">
                      <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
                      <p className="text-xs font-bold text-foreground truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action เฉพาะหน้า */}
            {pageActions.length > 0 && (
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Action หน้านี้
                </p>
                <div className="space-y-1.5">
                  {pageActions.map(({ id, ...rest }) => (
                    <ActionBtn key={id} id={id} {...rest} busy={busy} onRun={(k, l, fn) => run(k, l, fn)} />
                  ))}
                </div>
              </div>
            )}

            {/* Action ทั่วไป */}
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Action ทั่วไป</p>
              <div className="space-y-1.5">
                {globalActions.map(({ id, ...rest }) => (
                  <ActionBtn key={id} id={id} {...rest} busy={busy} onRun={(k, l, fn) => run(k, l, fn)} />
                ))}
                {/* purge-all แยกออกมา — เปิด confirm dialog โดยตรง ไม่ผ่าน run() */}
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={busy !== null}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-card border border-red-500/30 hover:border-red-500/60 hover:bg-red-500/5 text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">⚠️ ล้างข้อมูล settlement ทั้งหมด</span>
                </button>
              </div>
            </div>

            {/* ไปหน้า */}
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">ไปที่หน้า</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { href: "/dev", label: "จัดการผู้ใช้", icon: <Users className="h-3 w-3" /> },
                  { href: "/settlements", label: "Settlement", icon: <ReceiptText className="h-3 w-3" /> },
                  { href: "/adjustments", label: "Adjustment", icon: <FilePenLine className="h-3 w-3" /> },
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

            {/* ประวัติ */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ประวัติ</p>
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
                <p className="text-[10px] text-muted-foreground italic">ยังไม่มีการทดสอบ</p>
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
      {/* Confirm dialog — ล้าง settlement ทั้งหมด */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-red-500/10 rounded-xl shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <DialogTitle className="text-base">ล้างข้อมูล Settlement ทั้งหมด</DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed">
              ข้อมูลต่อไปนี้จะถูกลบถาวร และ<span className="font-bold text-foreground">ไม่สามารถกู้คืนได้</span>
            </DialogDescription>
            <ul className="mt-1 space-y-1 text-xs list-disc list-inside text-muted-foreground">
              <li>Settlement Run ทั้งหมด (ทุกสถานะ)</li>
              <li>Payout Lines ทั้งหมด</li>
              <li>Payout Documents ทั้งหมด</li>
              <li>Adjustments ที่ผูกกับ Settlement</li>
            </ul>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setConfirmOpen(false)}
              disabled={busy === "purge-all-settlements"}
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              disabled={busy === "purge-all-settlements"}
              onClick={() => {
                setConfirmOpen(false);
                run(
                  "purge-all-settlements",
                  "ล้างข้อมูล settlement ทั้งหมด",
                  () => devFetch("POST", "/v1/dev/actions/purge", { resource: "all-settlements" }),
                );
              }}
            >
              {busy === "purge-all-settlements"
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : "ยืนยัน ลบทั้งหมด"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionBtn({
  id,
  label,
  icon,
  action,
  busy,
  onRun,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => Promise<any>;
  busy: string | null;
  onRun: (id: string, label: string, fn: () => Promise<any>) => void;
}) {
  const isBusy = busy === id;
  return (
    <button
      onClick={() => onRun(id, label, action)}
      disabled={busy !== null}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-card border border-border/60 hover:border-orange-500/50 hover:bg-orange-500/5 text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
    >
      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : <span className="shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </button>
  );
}
