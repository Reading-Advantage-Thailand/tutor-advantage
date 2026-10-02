import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  /** Large screen title (tab roots: หน้าหลัก, คลาสเรียน, …). */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned slot, usually <IconButton>s or a <UserAvatar>. */
  actions?: ReactNode;
  /** Extra content under the title row (chips, SearchField, SegmentedControl…). */
  children?: ReactNode;
  className?: string;
}

/**
 * Large-title header for tab roots (not sticky). Adds the safe-top inset so it
 * clears the notch when it is the first thing on screen. Server-compatible.
 */
export function PageHeader({ title, subtitle, actions, children, className }: PageHeaderProps) {
  return (
    <header className={cn("px-4 pt-[calc(var(--safe-top)+20px)] pb-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-[1.3] font-extrabold text-fg">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm leading-[1.5] text-fg-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="-mr-1 flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}
