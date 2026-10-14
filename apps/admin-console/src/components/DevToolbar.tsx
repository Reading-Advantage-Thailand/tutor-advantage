"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Terminal, X, ChevronDown, RefreshCw,
  Zap, Trash2, Users, ReceiptText,
  ShieldAlert, FilePenLine, Loader2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
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
  // Every purge goes through a type-to-confirm dialog (they wipe shared local QA data).
  const [pendingPurge, setPendingPurge] = useState<{ id: string; label: string; fn: () => Promise<any> } | null>(null);

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

  const requestRun = (key: string, label: string, fn: () => Promise<any>) => {
    if (key.startsWith("purge")) setPendingPurge({ id: key, label, fn });
    else void run(key, label, fn);
  };

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
      icon: <Trash2 className="h-3.5 w-3.5 text-danger-fg" />,
      action: () => devFetch("POST", "/v1/dev/actions/purge", { resource: "fraud" }),
    },
    {
      id: "purge-adj",
      label: "ลบ adjustment DEV_TOOL ทั้งหมด",
      icon: <Trash2 className="h-3.5 w-3.5 text-danger-fg" />,
      action: () => devFetch("POST", "/v1/dev/actions/purge", { resource: "adjustments" }),
    },
    {
      id: "purge-settlements",
      label: "ลบ settlement PENDING (DEV) ทั้งหมด",
      icon: <Trash2 className="h-3.5 w-3.5 text-danger-fg" />,
      action: () => devFetch("POST", "/v1/dev/actions/purge", { resource: "settlements" }),
    },
  ].filter((ga) => !pageActionIds.has(ga.id.replace(/-g$/, "")));

  return (
    <>
      {/* ปุ่มลอย */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed right-3 bottom-[calc(var(--tabbar-space,0px)+12px)] z-[55] flex size-9 items-center justify-center rounded-full border border-warning-border bg-warning-bg text-warning-fg shadow-popover transition-colors hover:brightness-95 md:right-4 md:bottom-4"
        title="Dev Toolbar"
        aria-label="Dev Toolbar"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-4" /> : <Terminal className="size-4" />}
      </button>

      {/* แผง */}
      {open && (
        <div className="fixed right-3 bottom-[calc(var(--tabbar-space,0px)+56px)] z-[55] flex max-h-[min(80vh,calc(100dvh-var(--tabbar-space,0px)-80px))] w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-hairline bg-surface-elevated text-fg shadow-popover md:right-5 md:bottom-16 md:right-4">
          {/* หัว */}
          <div className="flex items-center justify-between px-4 py-3 bg-warning-bg border-b border-warning-border shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-warning-fg" />
              <span className="text-sm font-bold text-fg">เครื่องมือ Dev</span>
              <span className="rounded-full bg-warning-bg px-1.5 py-0.5 text-xs font-semibold text-warning-fg">DEV</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadState}
                className="p-1 rounded-lg hover:bg-press text-fg-muted hover:text-warning-fg transition-colors"
                title="รีเฟรช"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-press text-fg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* สถานะระบบ */}
            {state && (
              <div className="px-4 py-3 border-b border-hairline bg-surface-muted">
                <p className="text-xs font-semibold text-fg-muted mb-2">สถานะระบบ</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "ผู้ใช้", value: state.userCount },
                    { label: "ครูพิเศษ", value: state.tutorCount },
                    { label: "Adj. รอ", value: state.pendingAdjustments },
                    { label: "Fraud เปิด", value: state.openFraudFlags },
                    { label: "Run ล่าสุด", value: state.latestRun?.period ?? "—" },
                    { label: "สถานะ Run", value: state.latestRun?.status ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface rounded-lg p-2 border border-hairline">
                      <p className="text-xs text-fg-muted">{label}</p>
                      <p className="text-xs font-bold text-fg truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action เฉพาะหน้า */}
            {pageActions.length > 0 && (
              <div className="px-4 py-3 border-b border-hairline">
                <p className="text-xs font-semibold text-warning-fg mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Action หน้านี้
                </p>
                <div className="space-y-1.5">
                  {pageActions.map(({ id, ...rest }) => (
                    <ActionBtn key={id} id={id} {...rest} busy={busy} onRun={requestRun} />
                  ))}
                </div>
              </div>
            )}

            {/* Action ทั่วไป */}
            <div className="px-4 py-3 border-b border-hairline">
              <p className="text-xs font-semibold text-fg-muted mb-2">Action ทั่วไป</p>
              <div className="space-y-1.5">
                {globalActions.map(({ id, ...rest }) => (
                  <ActionBtn key={id} id={id} {...rest} busy={busy} onRun={requestRun} />
                ))}
                {/* purge-all แยกออกมา — เปิด confirm dialog โดยตรง ไม่ผ่าน run() */}
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={busy !== null}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-surface border border-danger-border hover:bg-danger-bg text-danger-fg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">ล้างข้อมูล settlement ทั้งหมด</span>
                </button>
              </div>
            </div>

            {/* ไปหน้า */}
            <div className="px-4 py-3 border-b border-hairline">
              <p className="text-xs font-semibold text-fg-muted mb-2">ไปที่หน้า</p>
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
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-surface-muted hover:bg-press text-fg border border-hairline transition-colors"
                  >
                    {icon} {label}
                  </a>
                ))}
              </div>
            </div>

            {/* ประวัติ */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-fg-muted">ประวัติ</p>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-xs text-fg-muted hover:text-fg"
                  >
                    ล้าง
                  </button>
                )}
              </div>
              {logs.length === 0 ? (
                <p className="text-xs text-fg-subtle">ยังไม่มีการทดสอบ</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {logs.map((l) => (
                    <div key={l.id} className="flex gap-2 text-xs font-mono">
                      <span className="text-fg-muted shrink-0">{l.ts}</span>
                      <span className={
                        l.type === "ok" ? "text-success-fg" :
                        l.type === "err" ? "text-danger-fg" : "text-fg-muted"
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
      {/* Confirm: ล้าง settlement ทั้งหมด */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
        title="ล้างข้อมูลรอบจ่ายเงินทั้งหมด"
        description="ลบรอบจ่ายเงินทุกสถานะ รายการจ่ายเงิน เอกสารจ่ายเงิน และรายการปรับปรุงยอดที่ผูกอยู่ ในฐานข้อมูลที่ใช้ร่วมกัน"
        irreversible
        requireText="DELETE"
        confirmLabel="ลบทั้งหมด"
        onConfirm={() =>
          run("purge-all-settlements", "ล้างข้อมูล settlement ทั้งหมด", () =>
            devFetch("POST", "/v1/dev/actions/purge", { resource: "all-settlements" }),
          )
        }
      />
      {/* Confirm: purge actions */}
      <ConfirmDialog
        open={pendingPurge !== null}
        onOpenChange={(next) => {
          if (!next) setPendingPurge(null);
        }}
        tone="danger"
        title={pendingPurge?.label ?? ""}
        description="ข้อมูลทดสอบในฐานข้อมูลที่ใช้ร่วมกันจะถูกลบถาวร"
        irreversible
        requireText="DELETE"
        confirmLabel="ลบ"
        onConfirm={async () => {
          const target = pendingPurge;
          if (target) await run(target.id, target.label, target.fn);
        }}
      />
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
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-surface border border-hairline hover:border-hairline-strong hover:bg-surface-muted text-fg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
    >
      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : <span className="shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </button>
  );
}
