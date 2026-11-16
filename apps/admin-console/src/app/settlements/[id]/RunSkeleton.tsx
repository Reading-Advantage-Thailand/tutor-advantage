import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton, StatGridSkeleton, TableSkeleton } from "@/components/app";

/**
 * Loading shape of one settlement run (header, KPI strip, compact lines
 * table, facts + timeline): shared by loading.tsx and the page while it
 * fetches, so nothing jumps when the record arrives. Server-compatible.
 */
export function RunSkeleton() {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <StatGridSkeleton />
      <div aria-hidden="true" className="flex items-end justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-56 rounded-(--radius-ctl)" />
      </div>
      <TableSkeleton columns={6} />
      <div aria-hidden="true" className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card flex flex-col gap-4 p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="card flex flex-col gap-4 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}
