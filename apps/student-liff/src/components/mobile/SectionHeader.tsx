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
  /** id on the heading, so the section can point at it: <section aria-labelledby={id}>. */
  id?: string;
  /** Small count pill after the title. */
  count?: number;
  /** Trailing text action with a 44px hit area ("ดูทั้งหมด"). */
  action?: SectionHeaderAction;
  /** Non-interactive element at the end of the row, e.g. a status chip ("พร้อมแล้ว 3/5"). Before `action` when both are set. */
  trailing?: ReactNode;
  /**
   * Let the trailing part drop under the title on narrow phones instead of
   * truncating the title (default: one row, the title truncates).
   */
  wrap?: boolean;
  /** Heading level (default h2). */
  as?: "h2" | "h3";
  className?: string;
}

/** Section title row with optional count, trailing chip and "see all" action. Server-compatible. */
export function SectionHeader({
  title,
  id,
  count,
  action,
  trailing,
  wrap = false,
  as: Heading = "h2",
  className,
}: SectionHeaderProps) {
  const actionClass =
    "pressable -mr-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-[var(--radius-ctl-sm)] px-2 font-heading text-[15px] leading-[1.3] font-semibold text-brand-fg active:bg-press";
  const actionNode = action ? (
    action.href ? (
      <Link href={action.href} onClick={action.onClick} className={actionClass}>
        {action.label}
        <ChevronRight className="size-5" aria-hidden="true" />
      </Link>
    ) : (
      <button type="button" onClick={action.onClick} className={actionClass}>
        {action.label}
      </button>
    )
  ) : null;
  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between",
        wrap ? "flex-wrap gap-x-3 gap-y-2" : "gap-3",
        className,
      )}
    >
      <Heading id={id} className="flex min-w-0 items-center gap-2 font-heading text-xl leading-[1.35] font-bold text-fg">
        <span className={cn("leading-[1.4]", !wrap && "truncate")}>{title}</span>
        {typeof count === "number" ? (
          <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-tile-neutral px-2 font-sans text-sm leading-none font-semibold text-icon-neutral tabular-nums">
            {count}
          </span>
        ) : null}
      </Heading>
      {trailing && actionNode ? (
        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          {actionNode}
        </div>
      ) : (
        (trailing ?? actionNode)
      )}
    </div>
  );
}
