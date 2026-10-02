import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionHeaderAction {
  /** Visible label, e.g. t("common.seeAll"). */
  label: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
}

export interface SectionHeaderProps {
  title: ReactNode;
  /** Small count pill after the title. */
  count?: number;
  /** Trailing text action with a 44px hit area ("ดูทั้งหมด"). */
  action?: SectionHeaderAction;
  /** Heading level (default h2). */
  as?: "h2" | "h3";
  className?: string;
}

/** Section title row with optional count and "see all" action. Server-compatible. */
export function SectionHeader({ title, count, action, as: Heading = "h2", className }: SectionHeaderProps) {
  const actionClass =
    "pressable -mr-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-xl px-2 text-sm font-semibold text-brand-fg active:bg-press";
  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-3", className)}>
      <Heading className="flex min-w-0 items-center gap-2 text-[17px] leading-[1.4] font-bold text-fg">
        <span className="truncate leading-[1.5]">{title}</span>
        {typeof count === "number" ? (
          <span className="shrink-0 rounded-full bg-fill-muted px-2 py-0.5 text-xs leading-[1.4] font-semibold text-fg-muted tabular-nums">
            {count}
          </span>
        ) : null}
      </Heading>
      {action ? (
        action.href ? (
          <Link href={action.href} onClick={action.onClick} className={actionClass}>
            {action.label}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={actionClass}>
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
