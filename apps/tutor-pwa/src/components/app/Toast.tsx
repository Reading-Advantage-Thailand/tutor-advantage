"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
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
  // 4 s, errors 6 s; nothing stays by default. A call may pass its own duration (0 = until dismissed).
  const duration = options.duration ?? (tone === "error" ? 6000 : 4000);
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

const toneIcon = { success: CircleCheck, error: CircleAlert, info: Info, warning: TriangleAlert } as const;
const toneTileClass = {
  success: "bg-success-bg text-success-fg",
  error: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
  warning: "bg-warning-bg text-warning-fg",
} as const;

/**
 * Toast viewport (components.md §10): elevated card with the rim, radius 14,
 * a 32px tone tile, 15px text. Bottom-centre above the tab bar on phones,
 * bottom-right on desktop; polite live region, never steals focus.
 */
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
              "toast-item flex items-start gap-3 rounded-[14px] border border-clay-rim bg-surface-elevated py-3 pr-3 pl-3 text-fg shadow-popover",
            )}
          >
            <span aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-(--radius-ctl-sm)", toneTileClass[item.tone])}>
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1 self-center">
              <p className="text-[0.9375rem] leading-[1.6] font-semibold">{item.message}</p>
              {item.description ? <p className="mt-0.5 text-sm text-fg-muted">{item.description}</p> : null}
            </div>
            <button
              type="button"
              aria-label={t("shell.close")}
              onClick={() => dismissToast(item.id)}
              className="relative flex size-8 shrink-0 items-center justify-center rounded-(--radius-ctl-sm) text-fg-subtle hover:bg-press hover:text-fg pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
