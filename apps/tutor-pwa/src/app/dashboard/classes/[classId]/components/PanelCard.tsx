import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CardHeader, IconTile, Surface, type TileTone } from "@/components/app";
import { cn } from "@/lib/utils";

/**
 * A titled card of the class pages (patterns.md T3/T4): the shared Surface
 * (1px clay rim) as a section named by its h2, and the shared CardHeader at
 * section size: a 40px tone tile, the title (Noto 600 18), one helper line and
 * an optional action on the right. `flush` content (rows) runs edge to edge
 * under a hairline; other content gets the card padding. Server-compatible.
 */
export function PanelCard({
  id,
  icon,
  tone = "brand",
  leading,
  title,
  description,
  action,
  flush,
  className,
  bodyClassName,
  children,
}: {
  /** id of the h2 (the section is labelled by it). */
  id: string;
  icon?: LucideIcon;
  tone?: TileTone;
  /** Replaces the icon tile (e.g. a step number). */
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Rows that run edge to edge (ListRow, divided lists). */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}) {
  return (
    <Surface as="section" padding="none" aria-labelledby={id} className={cn("overflow-hidden", className)}>
      <CardHeader
        as="h2"
        id={id}
        size="section"
        align="center"
        icon={leading ?? (icon ? <IconTile icon={icon} tone={tone} /> : null)}
        title={title}
        description={description}
        action={action}
        className="mb-0 px-4 pt-4 pb-3 md:px-5 md:pt-5"
      />
      {children ? (
        flush ? (
          <div className={cn("border-t border-hairline", bodyClassName)}>{children}</div>
        ) : (
          <div className={cn("px-4 pb-4 md:px-5 md:pb-5", bodyClassName)}>{children}</div>
        )
      ) : null}
    </Surface>
  );
}
