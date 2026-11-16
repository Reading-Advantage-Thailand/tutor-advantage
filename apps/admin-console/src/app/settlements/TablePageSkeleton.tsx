import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton, StatGridSkeleton, TableSkeleton } from "@/components/app";

/**
 * Loading shape of a finance table page (patterns.md A2/A5): header, optional
 * KPI strip, the toolbar (count tabs + search + filters), then the table card
 * with 10 row placeholders. Used by the route loading.tsx files of the
 * finance pages. Server-compatible.
 */
export function TablePageSkeleton({
  kpi = false,
  notice = false,
  columns = 6,
}: {
  kpi?: boolean;
  notice?: boolean;
  columns?: number;
}) {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      {notice ? <Skeleton className="h-12 w-full rounded-(--radius-card)" /> : null}
      {kpi ? <StatGridSkeleton /> : null}
      <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full rounded-(--radius-ctl) lg:w-80" />
        <Skeleton className="h-9 min-w-[200px] flex-1 rounded-(--radius-ctl) max-md:hidden" />
        <Skeleton className="h-9 w-24 rounded-(--radius-ctl) max-md:hidden" />
      </div>
      <TableSkeleton columns={columns} />
    </div>
  );
}
