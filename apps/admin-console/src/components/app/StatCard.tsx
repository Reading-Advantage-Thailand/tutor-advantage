import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconTile, type TileTone } from "./Atoms";

export interface StatCardProps {
  /** Short label, sentence case ("รายได้เดือนนี้"). */
  label: ReactNode;
  /** Pre-formatted value (use formatTHB / formatNumber). */
  value: ReactNode;
  icon?: LucideIcon;
  /** Icon tile tone; keep one tone per meaning (money = brand, students = teal…). */
  tone?: TileTone;
  /** Small line under the value ("จาก 12 คลาส"). */
  hint?: ReactNode;
  /** Change vs previous period, e.g. { value: "+12%", direction: "up" }. */
  delta?: { value: ReactNode; direction: "up" | "down" | "flat"; positive?: boolean };
  /** Optional chip/badge at the top-right. */
  badge?: ReactNode;
  href?: string;
  className?: string;
}

/**
 * KPI tile: neutral card, small icon tile, label, big tabular number.
 * Use in <Grid cols={4}> (2 per row on phones via className="grid-cols-2").
 * Server-compatible.
 */
export function StatCard({ label, value, icon, tone = "brand", hint, delta, badge, href, className }: StatCardProps) {
  const positive = delta ? (delta.positive ?? delta.direction === "up") : false;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8125rem] font-medium text-fg-muted">{label}</p>
        {badge ?? (icon ? <IconTile icon={icon} tone={tone} size="sm" /> : null)}
      </div>
      <p className="mt-2 text-2xl leading-tight font-bold text-fg tabular md:text-[1.625rem]">{value}</p>
      {delta || hint ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
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
          {hint ? <span className="min-w-0">{hint}</span> : null}
        </div>
      ) : null}
    </>
  );
  const classes = cn(
    "block min-w-0 rounded-xl border border-hairline bg-surface p-4 shadow-card",
    href && "pressable hover:border-hairline-strong",
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
