import { CardSkeleton, LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

/** Ticket detail while it loads: header, three bubbles + the composer, and the facts rail (≥1280). */
export function TicketDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <div aria-hidden="true" className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-5 w-24" />
          <div className="flex items-end gap-2.5">
            <Skeleton className="hidden size-8 shrink-0 rounded-full sm:block" />
            <Skeleton className="h-20 w-3/4 max-w-xl rounded-[14px]" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-16 w-2/3 max-w-lg rounded-[14px]" />
          </div>
          <div className="flex items-end gap-2.5">
            <Skeleton className="hidden size-8 shrink-0 rounded-full sm:block" />
            <Skeleton className="h-12 w-1/2 max-w-md rounded-[14px]" />
          </div>
          <CardSkeleton lines={5} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <CardSkeleton lines={7} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </div>
  );
}
