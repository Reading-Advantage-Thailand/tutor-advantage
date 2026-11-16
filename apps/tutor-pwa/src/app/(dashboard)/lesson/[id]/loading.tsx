import { LessonContent } from "@/components/app/LessonShell";
import { ListSkeleton, LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app/Skeletons";

/** Mirrors the lesson hub: header, the next-lesson hero + shortcuts, the 3-step strip. */
export default function LessonLoading() {
  return (
    <LessonContent width="wide">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <div aria-hidden="true" className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="overflow-hidden rounded-(--radius-card) border border-clay-rim bg-surface shadow-card">
          <div className="grid sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <Skeleton className="aspect-[16/9] h-auto w-full rounded-none sm:aspect-auto sm:h-full sm:min-h-64" />
            <div className="flex flex-col gap-4 p-5 md:p-6">
              <Skeleton className="size-16 rounded-(--radius-tile)" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-16 w-full rounded-(--radius-ctl)" />
              <Skeleton className="h-12 w-52 rounded-(--radius-ctl)" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <ListSkeleton rows={3} />
        </div>
      </div>
      <Skeleton className="h-28 w-full rounded-(--radius-card)" />
    </LessonContent>
  );
}
