import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

/** Mirrors the ticket thread: title, header card, a few bubbles and the composer. */
export default function TicketLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <div aria-hidden="true" className="flex items-start gap-3 rounded-(--radius-card) border border-clay-rim bg-surface p-4">
        <Skeleton className="size-10 shrink-0 rounded-(--radius-tile)" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5">
          <Skeleton className="mt-6 size-8 shrink-0 rounded-[30%]" />
          <Skeleton className="mt-6 h-16 w-3/5 rounded-[18px]" />
        </div>
        <Skeleton className="ml-auto h-12 w-1/2 rounded-[18px]" />
        <div className="flex items-start gap-2.5">
          <Skeleton className="mt-6 size-8 shrink-0 rounded-[30%]" />
          <Skeleton className="mt-6 h-10 w-2/5 rounded-[18px]" />
        </div>
      </div>
      <div aria-hidden="true" className="flex items-start gap-2">
        <Skeleton className="h-[52px] flex-1 rounded-[22px]" />
        <Skeleton className="mt-1 size-11 rounded-full" />
      </div>
    </div>
  );
}
