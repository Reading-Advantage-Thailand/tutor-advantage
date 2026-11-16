import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { IconTile, type TileTone } from "./Atoms";

export interface StatusScreenProps {
  icon: LucideIcon;
  tone?: TileTone;
  /** The page's h1. */
  title: ReactNode;
  /** One line naming the cause and the recovery. */
  description?: ReactNode;
  /** The primary action first (full width), then any others. */
  actions?: ReactNode;
  /** Extra content under the actions (e.g. the error reference with a copy button). */
  children?: ReactNode;
  role?: "alert" | "status";
  /** id of the h1 (the card's accessible name); change it if two share a page. */
  titleId?: string;
  className?: string;
}

/**
 * Full-page status (patterns.md "Not found" / "Error", admin column): one card
 * with a 48px tone tile, the page's h1, one line naming the cause and the
 * recovery, then the actions (the primary first, full width) and an optional
 * footer such as the error reference. Used by /unauthorized, the 404 and the
 * route error boundaries; put it in a <PublicFrame> when there is no shell.
 * Server-compatible.
 */
export function StatusScreen({
  icon,
  tone = "neutral",
  title,
  description,
  actions,
  children,
  role,
  titleId = "status-title",
  className,
}: StatusScreenProps) {
  return (
    <section
      role={role}
      aria-labelledby={titleId}
      className={cn("card flex w-full max-w-md flex-col items-center px-6 pt-8 pb-7 text-center sm:px-8 sm:pt-10 sm:pb-8", className)}
    >
      <IconTile icon={icon} tone={tone} size="lg" />
      <h1 id={titleId} className="mt-4 text-xl leading-[1.4] font-semibold text-fg text-balance-th sm:text-2xl sm:leading-[1.35]">
        {typeof title === "string" ? keepThaiWords(title) : title}
      </h1>
      {/* w-full: a definite width, so a long unbroken value (an email in the
          description) wraps inside the card instead of widening the line. */}
      {description ? <p className="mt-1.5 w-full max-w-sm text-base leading-[1.6] text-balance text-fg-muted lg:text-sm">{thaiCopy(description)}</p> : null}
      {actions ? <div className="mt-6 flex w-full flex-col gap-2">{actions}</div> : null}
      {children}
    </section>
  );
}
