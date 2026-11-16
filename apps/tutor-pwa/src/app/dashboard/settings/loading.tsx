import {
  CardSkeleton,
  ListSkeleton,
  LoadingAnnouncement,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/app/Skeletons";

/** Mirrors the settings layout: profile, the payout/documents column and the preferences rail. */
export default function SettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-[auto_1fr] xl:items-start xl:gap-x-6">
        <div aria-hidden="true" className="flex flex-col gap-2 xl:col-start-2 xl:row-start-1">
          <Skeleton className="my-3 h-5 w-24" />
          <div className="overflow-hidden rounded-(--radius-card) border border-clay-rim bg-surface">
            <div className="flex items-center gap-4 p-4 md:p-5">
              <Skeleton className="size-[52px] shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-56 max-w-full" />
              </div>
            </div>
            <div className="flex gap-2 border-t border-hairline bg-surface-muted px-4 py-3 md:px-5">
              <Skeleton className="h-7 w-32 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="flex min-w-0 flex-col gap-3 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <Skeleton className="my-3 h-5 w-48" />
          <div className="rounded-(--radius-card) border border-clay-rim bg-surface p-4 md:p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="size-12 shrink-0 rounded-(--radius-tile)" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3.5 w-56 max-w-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
              </div>
            </div>
            <Skeleton className="mt-5 h-2.5 w-full rounded-full" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </div>
          <CardSkeleton lines={4} />
          <CardSkeleton lines={3} />
        </div>
        <div aria-hidden="true" className="flex flex-col gap-5 xl:col-start-2 xl:row-start-2">
          <ListSkeleton rows={2} />
          <CardSkeleton lines={1} />
        </div>
      </div>
    </div>
  );
}
