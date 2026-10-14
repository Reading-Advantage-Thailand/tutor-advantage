import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface SkeletonTextProps {
  /** Number of lines (default 3); the last one is shorter. */
  lines?: number;
  className?: string;
}

/** Paragraph placeholder. Server-compatible. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)} aria-hidden="true">
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5 rounded-full", index === lines - 1 && lines > 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}

export interface CardSkeletonProps {
  /** Show the leading icon tile placeholder (default true). */
  media?: boolean;
  /** Text lines under the title (default 2). */
  lines?: number;
  className?: string;
}

/** Placeholder matching a <Surface> card with an icon tile and text. Server-compatible. */
export function CardSkeleton({ media = true, lines = 2, className }: CardSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {media ? <Skeleton className="size-10 shrink-0 rounded-xl" /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/3 rounded-full" />
          <Skeleton className="h-3 w-1/3 rounded-full" />
        </div>
      </div>
      {lines > 0 ? <SkeletonText lines={lines} className="mt-4" /> : null}
    </div>
  );
}

/**
 * Screen-reader-only "loading" announcement to pair with skeletons, e.g.
 * <LoadingAnnouncement /> once per loading screen.
 */
export function LoadingAnnouncement({ label }: { label?: string }) {
  return (
    <span role="status" className="sr-only">
      {label ?? t("common.loading")}
    </span>
  );
}
