import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** Shimmer block. Size it with className (h-4 w-32 …). Server-compatible. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton-block h-4 w-full", className)} />;
}

/** Visually hidden live-region text so screen readers hear "loading". */
export function LoadingAnnouncement({ label = t("shell.loading") }: { label?: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

/** A few lines of text. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Mirrors <PageHeader>. */
export function PageHeaderSkeleton({ actions = true }: { actions?: boolean }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="hidden h-7 w-56 md:block" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {actions ? <Skeleton className="h-9 w-36 rounded-lg" /> : null}
    </div>
  );
}

/** Mirrors a row of <StatCard>s. */
export function StatGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-hairline bg-surface p-4">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Mirrors a <ListGroup> of <ListRow>s. */
export function ListSkeleton({ rows = 4, leading = true, className }: { rows?: number; leading?: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("overflow-hidden rounded-xl border border-hairline bg-surface", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn("flex items-center gap-3 px-4 py-3.5", i > 0 && "border-t border-hairline")}>
          {leading ? <Skeleton className="size-10 shrink-0 rounded-lg" /> : null}
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Mirrors a <DataTable> (table on desktop, cards on phones). */
export function TableSkeleton({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      <div className="hidden overflow-hidden rounded-xl border border-hairline bg-surface md:block">
        <div className="flex gap-4 bg-surface-muted px-4 py-3">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex gap-4 border-t border-hairline px-4 py-3.5">
            {Array.from({ length: columns }, (_, c) => (
              <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "flex-[2]")} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }, (_, r) => (
          <div key={r} className="rounded-xl border border-hairline bg-surface p-4">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="mt-3 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A card with a title and text lines. */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("rounded-xl border border-hairline bg-surface p-5", className)}>
      <Skeleton className="h-4 w-40" />
      <SkeletonText lines={lines} className="mt-4" />
    </div>
  );
}

/**
 * Generic route loading.tsx body: header + stats + list. Pages with a very
 * different shape should compose the pieces above instead.
 */
export function PageSkeleton({
  stats = true,
  variant = "list",
}: {
  stats?: boolean;
  variant?: "list" | "table" | "cards";
}) {
  return (
    <div className="mx-auto flex w-full flex-col gap-6 lg:gap-8">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      {stats ? <StatGridSkeleton /> : null}
      {variant === "table" ? <TableSkeleton /> : null}
      {variant === "list" ? <ListSkeleton /> : null}
      {variant === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : null}
    </div>
  );
}
