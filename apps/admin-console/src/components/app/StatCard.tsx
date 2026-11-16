import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { IconTile, type TileTone } from "./Atoms";

/** One coloured share of a KPI micro-bar (bold graft). */
export interface StatBarSegment {
  /** 0–100 share of the bar. */
  value: number;
  /** Fill: a chart colour (default chart-1), or "danger" for the risk bar. */
  tone?: "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "brand" | "danger" | "warning";
}

const barToneClass: Record<NonNullable<StatBarSegment["tone"]>, string> = {
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
  brand: "bg-brand-vivid",
  danger: "bg-danger-solid",
  warning: "bg-warning-solid",
};

const PHRASE_SEPARATOR = " · ";

/**
 * Keeps each phrase of a "·"-joined line ("1 รายการ · PromptPay 1 · บัตร 0")
 * on one line, so the line breaks only after a "·" and Thai compounds such as
 * "ลงเรียน" never split (patterns.md "Thai text"). Other content is returned
 * as is. Server-compatible.
 */
export function nowrapPhrases(content: ReactNode, separator = PHRASE_SEPARATOR): ReactNode {
  if (typeof content !== "string" || !content.includes(separator)) return content;
  const parts = content.split(separator);
  return parts.map((part, index) => (
    <Fragment key={index}>
      <span className="whitespace-nowrap">{part}</span>
      {index < parts.length - 1 ? separator : null}
    </Fragment>
  ));
}

export interface StatCardProps {
  /** Short label, sentence case ("ยอดชำระสำเร็จ 30 วัน"). */
  label: ReactNode;
  /** Pre-formatted value (use formatTHB / formatNumber); Noto 600 24 tabular. */
  value: ReactNode;
  icon?: LucideIcon;
  /** Icon tile tone (32px, top-right); keep one tone per meaning (money = brand, risk = red…). */
  tone?: TileTone;
  /**
   * Small line under the value ("1 รายการ · PromptPay 1 · บัตร 0"). A string
   * hint breaks only after a "·": each phrase stays on one line.
   */
  hint?: ReactNode;
  /** Change vs previous period, e.g. { value: "+12%", direction: "up" }. */
  delta?: { value: ReactNode; direction: "up" | "down" | "flat"; positive?: boolean };
  /** Optional chip/badge at the top-right (replaces the icon tile). */
  badge?: ReactNode;
  /**
   * 4px proportion micro-bar under the hint (e.g. PromptPay vs card). Give it
   * `barLabel` with the split in words: the bar itself is decorative.
   */
  bar?: StatBarSegment[];
  barLabel?: string;
  /** Risk KPI: the value turns --danger-fg and the cell gets a 3px danger left edge. */
  risk?: boolean;
  /** The whole cell links somewhere. */
  href?: string;
  /** With `href`: a "→" text action under the value ("ดูรายการ →"). */
  actionLabel?: ReactNode;
  className?: string;
}

/**
 * KPI cell (components.md §3.5): label 500 13 + a 32px tone tile, value 600 24
 * tabular, hint 12, optional micro-bar, optional risk edge. Standalone it is a
 * card (1px rim, radius 12); inside <KpiStrip> the cells join into one card
 * with hairline dividers, and the cells of one row share their rows (label,
 * value, then hint + bar + link): a label that wraps to two lines moves every
 * value in that row down with it. Server-compatible.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = "brand",
  hint,
  delta,
  badge,
  bar,
  barLabel,
  risk,
  href,
  actionLabel,
  className,
}: StatCardProps) {
  const positive = delta ? (delta.positive ?? delta.direction === "up") : false;
  // In a linked cell the hint is part of the link's name, so it only gets
  // nowrap spans there: thaiCopy would put a no-break space in the name.
  const phrases = nowrapPhrases(hint);
  const hintText = typeof phrases === "string" && href ? keepThaiWords(phrases) : thaiCopy(phrases);
  // Hint, micro-bar and link are one block under the value (.stat-foot): in a
  // KPI strip the label and the value rows are shared across the row, and the
  // bar stays right under its own hint.
  const hasLink = Boolean(href && actionLabel);
  const hasFoot = Boolean(delta || hint || bar?.length || hasLink);
  const body = (
    <>
      <div className="stat-head flex items-start justify-between gap-2">
        <p className="stat-label">{typeof label === "string" ? keepThaiWords(label) : label}</p>
        {badge ?? (icon ? <IconTile icon={icon} tone={tone} size="sm" /> : null)}
      </div>
      <p className="stat-value">{value}</p>
      {hasFoot ? (
        <div className="stat-foot">
          {delta || hint ? (
            <div className="stat-hint flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {delta ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-semibold",
                    delta.direction === "flat" ? "text-fg-muted" : positive ? "text-success-fg" : "text-danger-fg",
                  )}
                >
                  {delta.direction === "up" ? <ArrowUpRight aria-hidden="true" className="size-3.5" /> : null}
                  {delta.direction === "down" ? <ArrowDownRight aria-hidden="true" className="size-3.5" /> : null}
                  {delta.value}
                </span>
              ) : null}
              {hint ? <span className="min-w-0">{hintText}</span> : null}
            </div>
          ) : null}
          {bar && bar.length ? (
            <div className="stat-bar" role={barLabel ? "img" : undefined} aria-label={barLabel} aria-hidden={barLabel ? undefined : true}>
              {bar.map((segment, index) => (
                <span
                  key={index}
                  className={barToneClass[segment.tone ?? (risk ? "danger" : "chart-1")]}
                  style={{ width: `${Math.min(100, Math.max(0, segment.value))}%` } as CSSProperties}
                />
              ))}
            </div>
          ) : null}
          {hasLink ? (
            <span className="stat-link">
              {actionLabel} <span aria-hidden="true">→</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
  const classes = cn("stat-card", className);
  const riskAttr = risk ? "" : undefined;
  return href ? (
    <Link href={href} className={classes} data-risk={riskAttr}>
      {body}
    </Link>
  ) : (
    <div className={classes} data-risk={riskAttr}>
      {body}
    </div>
  );
}

/**
 * The joined KPI strip (calm graft): one card, cells divided by hairlines,
 * 4 across from 1024px and 2×2 on phones (dividers on both axes). Children are
 * <StatCard>s. `aria-label` names the group ("ตัวเลขสำคัญ"). Server-compatible.
 */
export function KpiStrip({
  children,
  columns = 4,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  /** Cells per row from 1024px (default 4). */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <section aria-label={ariaLabel} className={cn("kpi-strip", className)} style={{ "--kpi-cols": columns } as CSSProperties}>
      {children}
    </section>
  );
}
