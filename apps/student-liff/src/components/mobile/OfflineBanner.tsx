"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** `true` while the browser is online (always `true` during SSR and hydration). */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Small "no internet" banner that renders only while offline. Place it under
 * the AppBar (or at the top of a list). Not mounted globally.
 */
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-card)] border-[1.5px] border-warning-border bg-warning-bg px-3.5 py-3 text-warning-fg",
        className,
      )}
    >
      <WifiOff aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.2} />
      <div className="min-w-0">
        <p className="text-[15px] leading-[1.5] font-semibold">{t("common.offlineTitle")}</p>
        <p className="text-sm leading-[1.6]">{t("common.offlineDescription")}</p>
      </div>
    </div>
  );
}
