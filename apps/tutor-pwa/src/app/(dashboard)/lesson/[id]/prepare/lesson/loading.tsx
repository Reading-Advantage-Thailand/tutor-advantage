import { LoadingAnnouncement, Skeleton } from "@/components/app/Skeletons";

/** Mirrors the rehearsal presenter: the phase bar (tile, name, 18 segments), the stage and the control dock. */
export default function PrepareLessonLoading() {
  return (
    <div className="flex min-h-(--lesson-viewport-h) w-full flex-col">
      <LoadingAnnouncement />
      <div aria-hidden="true" className="flex flex-col gap-3 border-b border-hairline bg-surface-nav px-4 pt-3 pb-3 lg:px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-(--radius-tile)" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-6 w-44" />
          </div>
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>
      <div aria-hidden="true" className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[44%_1fr] lg:px-6">
        <Skeleton className="h-64 rounded-(--radius-card) lg:h-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 rounded-(--radius-card)" />
          <Skeleton className="h-20 rounded-(--radius-card)" />
        </div>
      </div>
      <div aria-hidden="true" className="flex items-center justify-end gap-2 border-t border-hairline bg-surface-nav px-4 py-2.5">
        <Skeleton className="mr-auto h-5 w-28" />
        <Skeleton className="h-11 w-28 rounded-(--radius-ctl)" />
        <Skeleton className="h-11 w-36 rounded-(--radius-ctl)" />
      </div>
    </div>
  );
}
