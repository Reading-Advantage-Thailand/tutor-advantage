import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton, StatGridSkeleton, TableSkeleton } from "@/components/app";

/** Class attendance: header + summary strip + the students table (the meetings table follows below the fold). */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <StatGridSkeleton />
      <div aria-hidden="true" className="flex flex-col gap-3">
        <Skeleton className="h-5 w-40" />
        <TableSkeleton rows={6} columns={5} />
      </div>
    </div>
  );
}
