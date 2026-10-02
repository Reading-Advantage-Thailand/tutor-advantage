import { ListSkeleton, LoadingAnnouncement, PageHeaderSkeleton, Skeleton, StatGridSkeleton } from "@/components/app";

/** Mirrors the schedule page: toolbar, week strip + agenda, side stats. */
export default function ScheduleLoading() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div aria-hidden="true" className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-9 w-64 rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg sm:w-44" />
          </div>
          <Skeleton className="h-[76px] w-full rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <ListSkeleton rows={1} leading={false} />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <ListSkeleton rows={2} leading={false} />
          </div>
        </div>
        <div aria-hidden="true" className="flex flex-col gap-6">
          <StatGridSkeleton count={2} className="lg:grid-cols-1" />
        </div>
      </div>
    </div>
  );
}
