import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app/Skeletons";

/** Mirrors the demo page: the create card in the main column and the numbered steps card beside it. */
export default function DemoLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div aria-hidden="true" className="rounded-(--radius-card) border border-clay-rim bg-surface p-4 md:p-5">
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="size-12 rounded-(--radius-tile)" />
            <Skeleton className="h-5 w-44" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-11 w-full rounded-(--radius-field)" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
            <Skeleton className="h-12 w-full rounded-(--radius-ctl) sm:mb-[1.625rem] sm:w-32" />
          </div>
        </div>
        <div aria-hidden="true" className="flex flex-col gap-3 rounded-(--radius-card) border border-clay-rim bg-surface p-4 md:p-5">
          <div className="mb-1 flex items-center gap-3">
            <Skeleton className="size-10 rounded-(--radius-tile)" />
            <Skeleton className="h-4 w-32" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
