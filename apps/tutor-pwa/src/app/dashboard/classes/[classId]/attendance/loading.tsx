import { ListSkeleton, LoadingAnnouncement, PageHeaderSkeleton } from "@/components/app";

export default function AttendanceHistoryLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:gap-8">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <ListSkeleton rows={6} />
    </div>
  );
}
