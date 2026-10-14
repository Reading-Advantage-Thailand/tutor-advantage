import { CardSkeleton, LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

export default function ClassesLoading() {
  return (
    <div className="mx-auto flex w-full flex-col gap-6 lg:gap-8">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}
