import { CardSkeleton, ListSkeleton, LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

/** Mirrors the attendance history: header, phone view switch, meetings + students cards. */
export default function AttendanceHistoryLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <Skeleton className="h-11 w-full rounded-(--radius-ctl) lg:hidden" />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <ListSkeleton rows={6} />
        <CardSkeleton lines={5} className="max-lg:hidden" />
      </div>
    </div>
  );
}
