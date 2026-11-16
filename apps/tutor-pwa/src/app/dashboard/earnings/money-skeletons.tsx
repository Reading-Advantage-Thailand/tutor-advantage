import { Skeleton } from "@/components/app";
import { cn } from "@/lib/utils";

/*
 * Loading shapes shared by the money screens (earnings, network,
 * performance): they mirror the joined StatStrip and the ink wallet hero so
 * the page does not jump when the data lands (patterns.md, loading row).
 */

/** Mirrors <StatStrip>: one card, `cells` divided cells (2 × 2 on phones when 4). */
export function StatStripSkeleton({ cells = 4, className }: { cells?: 3 | 4; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "ds-card grid overflow-hidden",
        cells === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: cells }, (_, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col gap-2 px-4 py-3.5",
            i > 0 && "border-l border-hairline",
            cells === 4 && i === 2 && "max-sm:border-l-0",
            cells === 4 && i >= 2 && "max-sm:border-t",
          )}
        >
          <Skeleton className="h-3.5 w-20 max-w-full" />
          <Skeleton className="h-6 w-24 max-w-full" />
          <Skeleton className="h-3 w-16 max-w-full" />
        </div>
      ))}
    </div>
  );
}

/** Mirrors <WalletHero>: stacked on narrow widths, amount | goal from 768px. */
export function WalletHeroSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("ds-card grid gap-4 p-[18px] md:grid-cols-2 md:gap-7 md:px-6 md:py-[22px]", className)}>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-3.5 w-56 max-w-full" />
      </div>
      <div className="flex flex-col justify-center gap-2.5 border-t border-hairline pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-7">
        <div className="flex justify-between">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
        <Skeleton className="h-3.5 w-48 max-w-full" />
      </div>
    </div>
  );
}

/** A statement card: a title row then label/amount lines. */
export function StatementSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("ds-card overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 md:px-5 md:pt-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 border-t border-hairline px-4 py-3 md:px-5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}
