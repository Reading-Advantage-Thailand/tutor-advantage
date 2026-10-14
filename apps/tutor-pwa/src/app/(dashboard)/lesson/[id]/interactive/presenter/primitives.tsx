"use client";

/**
 * Small building blocks shared by the presenter phases. Sized for a
 * projector: large type, high-contrast tokens, no glows or gradients.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { clampPercent } from "@/components/app";

/** A–D answer colours. They match the student phones, so they carry meaning. */
export const OPTION_STYLES: Record<string, { tile: string; badge: string; bar: string }> = {
  A: { tile: "bg-rose-600 text-white", badge: "bg-black/20", bar: "#e11d48" },
  B: { tile: "bg-sky-600 text-white", badge: "bg-black/20", bar: "#0284c7" },
  C: { tile: "bg-amber-400 text-amber-950", badge: "bg-black/10", bar: "#f59e0b" },
  D: { tile: "bg-emerald-600 text-white", badge: "bg-black/20", bar: "#059669" },
};
export const FALLBACK_OPTION_STYLE = { tile: "bg-neutral-600 text-white", badge: "bg-black/20", bar: "#64748b" };

/** Panel surface used for every presenter block. */
export function StagePanel({
  className,
  children,
  as: Tag = "section",
  ...rest
}: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "aside";
  "data-tour-target"?: string;
  "aria-label"?: string;
}) {
  return (
    <Tag className={cn("rounded-xl border border-hairline bg-surface shadow-card", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Small label above a heading (Thai, no uppercase/tracking). */
export function StageEyebrow({ icon: Icon, children, className }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted", className)}>
      {Icon ? <Icon aria-hidden="true" className="size-4 text-brand-fg" /> : null}
      {children}
    </p>
  );
}

/** "ส่งแล้ว 2 / 3 คน" with a progress bar — the tutor's main waiting signal. */
export function AnswerProgress({
  answered,
  total,
  label,
  note,
  className,
  "data-tour-target": tourTarget,
}: {
  answered: number;
  total: number;
  label: string;
  note?: ReactNode;
  className?: string;
  "data-tour-target"?: string;
}) {
  const pct = total > 0 ? clampPercent((answered / total) * 100) : 0;
  const complete = total > 0 && answered >= total;
  return (
    <div data-tour-target={tourTarget} className={cn("flex w-full max-w-md flex-col items-center gap-2", className)}>
      <p role="status" aria-live="polite" className="text-base text-fg-muted">
        {label}{" "}
        <span className={cn("text-xl font-bold tabular-nums", complete ? "text-success-fg" : "text-fg")}>
          {answered} / {total}
        </span>
      </p>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-fill-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", complete ? "bg-success-solid" : "bg-brand-vivid")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {note ? <div className="text-sm font-medium text-fg-muted">{note}</div> : null}
    </div>
  );
}

/** Rehearsal-only status line ("รอนักเรียนตอบ… 2/4 คน"). */
export function PreparationStatus({ text, done }: { text: string | null; done?: boolean }) {
  if (!text) return null;
  return <p className={cn("text-sm font-semibold", done ? "text-success-fg" : "text-warning-fg")}>{text}</p>;
}

/** Large number + label tile for result summaries. */
export function ResultStat({
  label,
  value,
  unit,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "success" | "danger" | "warning" | "info" | "neutral" | "brand";
  className?: string;
}) {
  const toneClass = {
    success: "border-success-border bg-success-bg text-success-fg",
    danger: "border-danger-border bg-danger-bg text-danger-fg",
    warning: "border-warning-border bg-warning-bg text-warning-fg",
    info: "border-info-border bg-info-bg text-info-fg",
    neutral: "border-hairline bg-surface-muted text-fg",
    brand: "border-brand-soft-border bg-brand-soft text-brand-fg",
  }[tone];
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border px-4 py-3", toneClass, className)}>
      <p className="text-sm font-medium text-fg-muted">{label}</p>
      <p className="text-3xl font-bold tabular-nums leading-none">
        {value}
        {unit ? <span className="ml-1 text-base font-medium text-fg-muted">{unit}</span> : null}
      </p>
    </div>
  );
}

/** Centred message for phases without enough content. */
export function StageEmpty({ message, tourTarget, statusTarget }: { message: string; tourTarget?: string; statusTarget?: string }) {
  return (
    <div data-tour-target={tourTarget} className="flex flex-1 items-center justify-center p-6">
      <div
        data-tour-target={statusTarget}
        className="rounded-xl border border-dashed border-hairline-strong bg-surface px-8 py-10 text-center text-xl font-semibold text-fg-muted"
      >
        {message}
      </div>
    </div>
  );
}
