"use client";

import { ErrorState } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";

/**
 * LINE start-up failed (or there is no profile): friendly error with a retry
 * that re-runs start-up, instead of a spinner that never ends.
 */
export function LiffStartupError({ className }: { className?: string }) {
  const { errorCode, retry } = useLiff();
  return <ErrorState kind={errorCode === "network" ? "offline" : "error"} onRetry={retry} className={className} />;
}
