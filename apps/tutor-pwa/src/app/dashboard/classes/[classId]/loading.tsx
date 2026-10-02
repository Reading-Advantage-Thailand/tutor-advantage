import { CardSkeleton, ListSkeleton, LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

export default function ClassDetailLoading() {
  return (
    <div className="mx-auto flex w-full flex-col gap-6 lg:gap-8">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <Skeleton className="h-10 w-full rounded-lg lg:hidden" />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="flex flex-col gap-6">
          <CardSkeleton lines={8} />
          <CardSkeleton lines={3} />
        </div>
        <div className="flex flex-col gap-6">
          <CardSkeleton lines={3} />
          <ListSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}
