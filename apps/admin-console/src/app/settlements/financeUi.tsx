"use client";

import { ErrorState } from "@/components/app";
import { ApiError, errorMessage } from "@/lib/api";
import { formatThaiDate, formatThaiTime, type ThaiDateStyle } from "@/lib/format";

/**
 * Shared bits for the finance pages (settlements, reconciliation, adjustments,
 * operations, fraud). Presentation only.
 */

/**
 * After "ล้างตัวกรอง" the button that was pressed disappears (nothing is
 * filtered any more), so focus would fall to <body>. Put it back on the
 * toolbar: the search box, else the selected count tab, else the first select.
 */
export function focusToolbar(root: HTMLElement | null) {
  requestAnimationFrame(() => {
    const target =
      root?.querySelector<HTMLElement>('input[type="search"]') ??
      root?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
      root?.querySelector<HTMLElement>("select, button");
    target?.focus();
  });
}

/**
 * The text of formatThaiDateTime(at, style) in two unbreakable parts: the date
 * and the time each stay whole, and the time drops under the date only when
 * the table column is narrow (so wide tables still fit their card).
 */
export function DateTimeParts({ at, style = "medium" }: { at: string; style?: ThaiDateStyle }) {
  return (
    <>
      <span className="whitespace-nowrap">{formatThaiDate(at, style)}</span>{" "}
      <span className="whitespace-nowrap">{formatThaiTime(at, { suffix: true })}</span>
    </>
  );
}

/** Load error for a table or a record (patterns.md: tone tile + cause + retry + the error ID to copy). */
export function LoadError({ error, onRetry, title }: { error: unknown; onRetry: () => unknown; title?: string }) {
  return (
    <ErrorState
      title={title}
      description={errorMessage(error)}
      onRetry={onRetry}
      digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined}
    />
  );
}
