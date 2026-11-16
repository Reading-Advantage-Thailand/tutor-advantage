import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

/** Mirrors the auction page: header, then claim cards (tile + title, facts well, bonus + button). */
export default function AuctionLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <div aria-hidden="true" className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-2">
        {[0, 1].map((key) => (
          <div key={key} className="ds-card flex flex-col gap-3 p-4 md:p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 shrink-0 rounded-(--radius-tile)" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3.5 w-1/3" />
              </div>
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            <Skeleton className="h-20 w-full rounded-(--radius-ctl)" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-11 w-full rounded-(--radius-ctl) sm:w-44" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
