"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatCountdown, getQrSecondsLeft } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";

export interface QrCountdownProps {
  /** Epoch ms deadline (from the flow); only this leaf re-renders every second. */
  expiresAt: number;
  className?: string;
}

/**
 * "QR หมดอายุใน 14:32". Remaining time is derived from the stored deadline and
 * Date.now(), so it is right again the moment LINE comes back from the banking
 * app (background timers are throttled).
 */
export function QrCountdown({ expiresAt, className }: QrCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [expiresAt]);

  const secondsLeft = getQrSecondsLeft(expiresAt, now);
  const urgent = secondsLeft <= 60;

  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 text-sm leading-[1.5] font-medium",
        urgent ? "text-danger-fg" : "text-fg-muted",
        className,
      )}
    >
      <Clock aria-hidden="true" className="size-4 shrink-0" />
      <span>{t("payment.promptpay.expiresIn")}</span>
      <span role="timer" className="font-bold tabular-nums">
        {formatCountdown(secondsLeft)}
      </span>
    </p>
  );
}
