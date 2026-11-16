"use client";

import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/app";
import { cn } from "@/lib/utils";

/*
 * Building blocks for the A4 form sheets of this group (create class, coupon,
 * discount code, offline amount): fieldsets with a section legend, a
 * two-column field row from 768px, the review "well", the code ticket shown
 * after a create, and the sticky footer row (secondary, then the primary).
 */

/** A titled group of fields (legend = section title, Noto 600 16). */
export function FormSection({ legend, children, className }: { legend: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-4", className)}>
      <legend className="mb-3 text-base leading-normal font-semibold text-fg">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Divider between form sections. */
export function FormDivider() {
  return <div aria-hidden="true" className="h-px bg-hairline" />;
}

/** Two fields side by side from 768px (labels above), stacked on phones. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">{children}</div>;
}

/** Grouped read-only facts inside a sheet (review step): --surface-muted, radius 8, no rim. */
export function ReviewWell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-(--radius-ctl) bg-surface-muted p-4", className)}>{children}</div>;
}

/**
 * Sheet footer: secondary first, primary last, in the same order on screen as in the DOM so Tab
 * follows what is seen (phones: stacked full width, primary at the bottom; from 768px: a row, primary on the right).
 */
export function SheetFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 md:flex-row md:justify-end">{children}</div>;
}

/** The new code after a create: large monospace code + copy, in the success tone. */
export function CodeTicket({ code, copyLabel, size = "lg" }: { code: string; copyLabel: string; size?: "lg" | "md" }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-(--radius-card) border border-success-border bg-success-bg py-3 pr-2 pl-4">
      <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-success-fg" />
      <code
        title={code}
        className={cn("min-w-0 flex-1 truncate font-mono font-semibold tracking-wide text-fg", size === "lg" ? "text-xl leading-snug" : "text-base")}
      >
        {code}
      </code>
      <CopyButton value={code} label={copyLabel} />
    </div>
  );
}
