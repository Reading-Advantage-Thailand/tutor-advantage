import { CardSkeleton, ListSkeleton, LoadingAnnouncement, PageHeaderSkeleton, StatGridSkeleton } from "@/components/app";

/** Dev database: header, KPI strip, then the table list + danger zone beside the details. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <StatGridSkeleton count={4} />
      <div aria-hidden="true" className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <ListSkeleton rows={8} leading={false} />
          <CardSkeleton lines={4} />
        </div>
        <CardSkeleton lines={6} />
      </div>
    </div>
  );
}
