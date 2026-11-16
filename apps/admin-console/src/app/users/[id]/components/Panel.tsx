import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A titled card for the user record pages: the title row sits inside the card
 * above a hairline (the same chrome as the danger zone and the status rail),
 * the body below. A <section> named by its h2. Server-compatible. `id` is
 * explicit (not useId) so the server HTML and hydration always agree.
 */
export function Panel({
  id,
  title,
  icon,
  action,
  meta,
  tone = "default",
  bodyClassName,
  className,
  children,
}: {
  /** Unique on the page; the heading gets `${id}-title`. */
  id: string;
  title: ReactNode;
  /** Leading IconTile. */
  icon?: ReactNode;
  /** Right side of the title row (a link or small button). */
  action?: ReactNode;
  /** Short text after the title (e.g. "3 รายการ"). */
  meta?: ReactNode;
  /** "danger": danger rim (the danger zone). */
  tone?: "default" | "danger";
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("card min-w-0 overflow-hidden", tone === "danger" && "border-danger-border", className)}
    >
      <div className={cn("flex min-h-13 items-center gap-3 border-b border-hairline py-2 pl-4", action ? "pr-2" : "pr-4")}>
        {icon}
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <h2 id={headingId} className="text-base leading-normal font-semibold text-fg">
            {title}
          </h2>
          {meta ? <span className="text-[0.8125rem] text-fg-muted tabular">{meta}</span> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
