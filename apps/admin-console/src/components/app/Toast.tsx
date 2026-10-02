"use client";

import { CheckCircle2, Info, X, XCircle, AlertTriangle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  description?: string;
  /** ms; 0 = sticky until dismissed. */
  duration: number;
}

type Listener = () => void;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(tone: ToastTone, message: string, options: { description?: string; duration?: number } = {}): number {
  const id = nextId++;
  const duration = options.duration ?? (tone === "error" ? 6000 : 3500);
  items = [...items.slice(-2), { id, tone, message, description: options.description, duration }];
  emit();
  if (duration > 0 && typeof window !== "undefined") {
    timers.set(id, setTimeout(() => dismissToast(id), duration));
  }
  return id;
}

/**
 * Lightweight toasts (no dependency). <Toaster/> is mounted by AppShell and
 * LessonShell; call these from any client component.
 * toast.success("บันทึกแล้ว") · toast.error("บันทึกไม่สำเร็จ", { description })
 */
export const toast = Object.assign(
  (message: string, options?: { description?: string; duration?: number }) => push("info", message, options),
  {
    success: (message: string, options?: { description?: string; duration?: number }) => push("success", message, options),
    error: (message: string, options?: { description?: string; duration?: number }) => push("error", message, options),
    warning: (message: string, options?: { description?: string; duration?: number }) => push("warning", message, options),
    info: (message: string, options?: { description?: string; duration?: number }) => push("info", message, options),
    dismiss: dismissToast,
  },
);

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const getSnapshot = () => items;
const EMPTY_TOASTS: ToastItem[] = [];
const getServerSnapshot = () => EMPTY_TOASTS;

const toneIcon = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle } as const;
const toneIconClass = {
  success: "text-success-fg",
  error: "text-danger-fg",
  info: "text-info-fg",
  warning: "text-warning-fg",
} as const;

/** Toast viewport. Bottom-centre above the tab bar on phones, bottom-right on desktop. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {list.map((item) => {
        const Icon = toneIcon[item.tone];
        return (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            className={cn(
              "toast-item flex items-start gap-3 rounded-xl border border-hairline bg-surface-elevated px-4 py-3 text-fg shadow-popover",
            )}
          >
            <Icon aria-hidden="true" className={cn("mt-0.5 size-[18px] shrink-0", toneIconClass[item.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.message}</p>
              {item.description ? <p className="mt-0.5 text-[0.8125rem] text-fg-muted">{item.description}</p> : null}
            </div>
            <button
              type="button"
              aria-label={t("shell.close")}
              onClick={() => dismissToast(item.id)}
              className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-press hover:text-fg"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
