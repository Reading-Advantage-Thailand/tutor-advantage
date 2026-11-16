"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { IconTile } from "./Atoms";
import { CopyButton } from "./IdCell";

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
  /**
   * Title heading level (default h2, right under the page h1). Use h1 when the
   * block replaces the page (a route error.tsx), h3 under a Section/Sheet title.
   */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

/**
 * Error block with retry. Use for failed fetches (`error && !data`) and in
 * route-segment error.tsx files (`onRetry={reset}`).
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
  as: Heading = "h2",
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
        compact ? "px-4 py-8" : "card px-6 py-10",
        page && "min-h-[50vh]",
        className,
      )}
    >
      <IconTile icon={AlertTriangle} tone="red" size="md" />
      <Heading className="mt-3 text-base leading-normal font-semibold text-fg">{typeof title === "string" ? keepThaiWords(title) : title}</Heading>
      {/* Thai body line-height (1.6) and balanced lines, so a two-line cause/recovery does not end in one word. */}
      {description ? <p className="mt-1 max-w-md text-sm leading-[1.6] text-balance text-fg-muted">{thaiCopy(description)}</p> : null}
      {onRetry || action ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
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
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-fg-subtle">
          {t("shell.errorCode")}: <span className="font-mono">{digest}</span>
          <CopyButton value={digest} label={t("shell.copyId")} />
        </p>
      ) : null}
    </div>
  );
}
