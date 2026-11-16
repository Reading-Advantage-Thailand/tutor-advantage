import { CardSkeleton, ListSkeleton, LoadingAnnouncement, Skeleton } from "@/components/app";

/** Mirrors the class page: header card, phone tabs, lesson picker + overview rail. */
export default function ClassDetailLoading() {
  return (
    <div className="mx-auto flex w-full flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <div aria-hidden="true" className="flex flex-col gap-3">
        {/* The back link's box (32, 44 on touch), so the header card does not jump when the page arrives. */}
        <div className="hidden h-8 items-center md:flex pointer-coarse:h-11">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="ds-card overflow-hidden">
          <div className="flex items-start gap-3 py-4 pr-4 pl-5 md:gap-4 md:py-6 md:pr-6 md:pl-7">
            <Skeleton className="size-12 shrink-0 rounded-(--radius-tile) md:size-14" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <Skeleton className="h-6 w-3/5 md:h-8" />
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-12 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            </div>
            <Skeleton className="hidden h-11 w-32 rounded-(--radius-ctl) lg:block" />
          </div>
          <div className="border-t border-hairline py-3 pr-4 pl-5 md:pl-7">
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>
      <Skeleton className="h-11 w-full rounded-(--radius-ctl) lg:hidden" />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_384px]">
        <div aria-hidden="true" className="ds-card overflow-hidden">
          <div className="flex flex-col gap-4 p-4 md:p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-(--radius-tile)" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Skeleton className="h-11 rounded-(--radius-ctl)" />
              <Skeleton className="h-11 rounded-(--radius-ctl)" />
            </div>
          </div>
          <ListSkeleton rows={6} className="rounded-none border-x-0 border-b-0" />
        </div>
        <div className="flex flex-col gap-5 max-lg:hidden">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    </div>
  );
}
