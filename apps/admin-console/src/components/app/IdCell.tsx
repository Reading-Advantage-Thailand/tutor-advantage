"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { shortId } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Copy-to-clipboard icon button (ids, coupon codes, references). */
export function CopyButton({ value, label = t("shell.copy"), className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // clipboard blocked: nothing to do
        }
      }}
      aria-label={copied ? t("shell.copied") : label}
      title={copied ? t("shell.copied") : label}
      className={cn(
        "relative z-[1] inline-flex size-6 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-press hover:text-fg pointer-coarse:size-8",
        className,
      )}
    >
      {copied ? <Check aria-hidden="true" className="size-3.5 text-success-fg" /> : <Copy aria-hidden="true" className="size-3.5" />}
    </button>
  );
}

/**
 * Short id + copy button ("5eed0000…0101 ⧉"). Use for UUIDs and references
 * in tables and detail pages; never show a full UUID as primary text.
 */
export function IdCell({ id, label, className }: { id: string | null | undefined; label?: string; className?: string }) {
  if (!id) return <span className="text-fg-subtle">–</span>;
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 align-middle", className)}>
      {label ? <span className="text-xs text-fg-muted">{label}</span> : null}
      <code className="truncate font-mono text-xs text-fg-muted" title={id}>
        {shortId(id)}
      </code>
      <CopyButton value={id} label={t("shell.copyId")} />
    </span>
  );
}
