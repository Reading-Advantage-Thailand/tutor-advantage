import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton, StatGridSkeleton, TableSkeleton } from "@/components/app";

/**
 * Route loading body for the A2 table pages of this group (classes, coupons,
 * discount codes): header → optional KPI strip → count-tab toolbar → table
 * card with 10 row placeholders (patterns.md, Empty/error/loading). Same
 * shapes as the loaded page, so nothing jumps when it arrives.
 * Server-compatible.
 */
export function TablePageSkeleton({ stats = false, columns = 6 }: { stats?: boolean; columns?: number }) {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      {stats ? <StatGridSkeleton /> : null}
      <div className="flex flex-col gap-3">
        <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-full rounded-(--radius-ctl) pointer-coarse:h-11 lg:w-72" />
          <Skeleton className="h-9 min-w-[200px] flex-1 rounded-(--radius-ctl) pointer-coarse:h-11" />
          <Skeleton className="hidden h-9 w-28 rounded-(--radius-ctl) md:block" />
        </div>
        <TableSkeleton columns={columns} />
      </div>
    </div>
  );
}
