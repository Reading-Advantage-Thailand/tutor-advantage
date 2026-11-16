"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { IconTile } from "./Atoms";

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Retry handler (refetch / error-boundary reset). The button shows a spinner while it runs. */
  onRetry?: () => unknown;
  retryLabel?: string;
  /** Next.js error digest, shown small for support. */
  digest?: string;
  /** Extra actions next to retry (e.g. back link). */
  action?: ReactNode;
  /** Inside a card: less padding, no border. */
  compact?: boolean;
  /** Full page block (route error.tsx): more vertical space. */
  page?: boolean;
  className?: string;
}

/**
 * Error block with retry (components.md §10): a card with a 56px red tone
 * tile, the cause and the recovery, and a tonal "ลองอีกครั้ง". Use for failed
 * fetches (`error && !data`) and in route-segment error.tsx files
 * (`onRetry={reset}`).
 */
export function ErrorState({
  title = t("shell.errorTitle"),
  description = t("shell.errorBody"),
  onRetry,
  retryLabel = t("shell.retry"),
  digest,
  action,
  compact,
  page,
  className,
}: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false);
  const handleRetry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "rounded-(--radius-card) border border-clay-rim bg-surface px-6 py-10 shadow-card",
        page && "min-h-[50vh]",
        className,
      )}
    >
      <IconTile icon={AlertTriangle} tone="red" size="xl" />
      <h2 className="mt-4 type-section text-balance-th text-fg">{thaiLabel(title)}</h2>
      {description ? <p className="mt-1 max-w-md text-sm leading-[1.6] text-balance-th text-fg-muted">{thaiCopy(description)}</p> : null}
      {onRetry || action ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {onRetry ? (
            <Button variant="tonal" onClick={handleRetry} loading={retrying}>
              {retrying ? null : <RotateCw aria-hidden="true" />}
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
      {digest ? (
        <p className="mt-4 text-xs text-fg-subtle">
          {t("shell.errorCode")}: <span className="font-mono">{digest}</span>
        </p>
      ) : null}
    </div>
  );
}
