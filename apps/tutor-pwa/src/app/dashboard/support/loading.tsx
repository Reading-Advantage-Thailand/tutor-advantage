import { CardSkeleton, ListSkeleton, LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

/** Mirrors the ticket list: header, a titled group of rows, and the LINE help card beside it on desktop. */
export default function SupportLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
        <div aria-hidden="true" className="flex min-w-0 flex-col gap-2">
          <div className="flex min-h-11 items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-[22px] w-[22px] rounded-full" />
          </div>
          <ListSkeleton rows={4} leading />
        </div>
        <CardSkeleton lines={1} />
      </div>
    </div>
  );
}
