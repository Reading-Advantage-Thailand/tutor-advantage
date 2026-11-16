import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

/** Mirrors the mark page: header, the totals strip and roster rows with their status control. */
export default function AttendanceMeetingLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <div aria-hidden="true" className="ds-card grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2 px-4 py-3.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-6 w-8" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="ds-card overflow-hidden">
        <div className="px-4 pt-4 pb-3 md:px-5">
          <Skeleton className="h-5 w-32" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3 border-t border-hairline px-4 py-3 md:flex-row md:items-center md:px-5">
            <div className="flex flex-1 items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-11 w-full rounded-(--radius-ctl) md:w-56" />
          </div>
        ))}
      </div>
    </div>
  );
}
