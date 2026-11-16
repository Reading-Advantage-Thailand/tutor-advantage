"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { shortId } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toast } from "./toastStore";

/**
 * Copy-to-clipboard icon button (ids, coupon codes, references): 28px visual,
 * 36px hit area (44px under pointer: coarse), a check for 1.5s plus a polite
 * toast after copying.
 */
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
          toast.success(t("shell.copied"));
        } catch {
          // clipboard blocked: nothing to do
        }
      }}
      aria-label={copied ? t("shell.copied") : label}
      title={copied ? t("shell.copied") : label}
      className={cn(
        "relative z-[1] inline-flex size-7 shrink-0 items-center justify-center rounded-(--radius-ctl-sm) text-fg-subtle transition-colors after:absolute after:-inset-1 hover:bg-press hover:text-fg pointer-coarse:size-11 pointer-coarse:after:inset-0",
        className,
      )}
    >
      {copied ? <Check aria-hidden="true" className="size-4 text-success-fg" /> : <Copy aria-hidden="true" className="size-3.5" />}
    </button>
  );
}

/**
 * Short id + copy button ("5eed0000…0101 ⧉"), monospace 13. Use for UUIDs and
 * references in tables and detail pages; never show a full UUID as primary
 * text (the full value is in the title and in the copy).
 */
export function IdCell({ id, label, className }: { id: string | null | undefined; label?: string; className?: string }) {
  if (!id) return <span className="text-fg-subtle">–</span>;
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 align-middle", className)}>
      {label ? <span className="text-xs text-fg-muted">{label}</span> : null}
      <code className="truncate font-mono text-[0.8125rem] text-fg-muted" title={id}>
        {shortId(id)}
      </code>
      <CopyButton value={id} label={t("shell.copyId")} />
    </span>
  );
}
