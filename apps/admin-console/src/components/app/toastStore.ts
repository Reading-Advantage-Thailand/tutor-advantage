/**
 * Toast store + `toast()` API (no UI). Pages import `toast` from here so they
 * don't bundle the <Toaster/> viewport, which the shell already mounts.
 */
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

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getToastsSnapshot = () => items;
const EMPTY_TOASTS: ToastItem[] = [];
export const getServerToastsSnapshot = () => EMPTY_TOASTS;
