"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { dismissToast, getServerToastsSnapshot, getToastsSnapshot, subscribeToasts, type ToastTone } from "./toastStore";

export { dismissToast, toast, type ToastItem, type ToastTone } from "./toastStore";

const toneIcon = { success: CircleCheck, error: CircleAlert, info: Info, warning: TriangleAlert } as const;
const toneTileClass = {
  success: "bg-success-bg text-success-fg",
  error: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
  warning: "bg-warning-bg text-warning-fg",
} as const;

/**
 * Toast viewport (components.md §10): --surface-elevated, 1px rim, radius 10,
 * --shadow-popover, a 32px tone tile. Polite live region, never steals focus.
 * Bottom-centre above the tab bar on phones, bottom-right on desktop.
 */
export function Toaster() {
  const list = useSyncExternalStore(subscribeToasts, getToastsSnapshot, getServerToastsSnapshot);
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {list.map((item) => (
        <ToastCard
          key={item.id}
          tone={item.tone}
          message={item.message}
          description={item.description}
          onDismiss={() => dismissToast(item.id)}
          className="toast-item"
        />
      ))}
    </div>
  );
}

/** One toast (also rendered statically in /dev/ui-kit). */
export function ToastCard({
  tone,
  message,
  description,
  onDismiss,
  className,
}: {
  tone: ToastTone;
  message: string;
  description?: string;
  onDismiss?: () => void;
  className?: string;
}) {
  const Icon = toneIcon[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-[10px] border border-clay-rim bg-surface-elevated py-2.5 pr-2 pl-2.5 text-fg shadow-popover",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-(--radius-tile)", toneTileClass[tone])}>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1 self-center py-0.5">
        <p className="text-sm leading-[1.6] font-semibold">{thaiCopy(message)}</p>
        {description ? <p className="mt-0.5 text-[0.8125rem] leading-[1.6] text-fg-muted">{thaiCopy(description)}</p> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label={t("shell.close")}
          onClick={onDismiss}
          className="flex size-8 shrink-0 items-center justify-center rounded-(--radius-ctl) text-fg-subtle hover:bg-press hover:text-fg pointer-coarse:size-11"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
