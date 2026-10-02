"use client";

import { CheckCircle2, Info, X, XCircle, AlertTriangle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { dismissToast, getServerToastsSnapshot, getToastsSnapshot, subscribeToasts } from "./toastStore";

export { dismissToast, toast, type ToastItem, type ToastTone } from "./toastStore";

const toneIcon = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle } as const;
const toneIconClass = {
  success: "text-success-fg",
  error: "text-danger-fg",
  info: "text-info-fg",
  warning: "text-warning-fg",
} as const;

/** Toast viewport. Bottom-centre above the tab bar on phones, bottom-right on desktop. */
export function Toaster() {
  const list = useSyncExternalStore(subscribeToasts, getToastsSnapshot, getServerToastsSnapshot);
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
