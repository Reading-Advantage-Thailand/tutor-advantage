import { LessonContent } from "@/components/app/LessonShell";
import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app/Skeletons";

/** Mirrors the lesson picker: header, sticky toolbar, the chapter cards (row cards on phones, cover-first from 640px). */
export default function SelectLessonLoading() {
  return (
    <LessonContent width="wide" className="gap-4 md:gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <div aria-hidden="true" className="flex flex-col gap-2 md:flex-row md:items-center">
        <Skeleton className="h-11 rounded-(--radius-field) md:max-w-md" />
        <Skeleton className="h-11 rounded-(--radius-ctl) md:ml-auto md:w-72" />
      </div>
      <div aria-hidden="true" className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex gap-3 overflow-hidden rounded-(--radius-card) border border-clay-rim bg-surface p-3 sm:flex-col sm:gap-0 sm:p-0"
          >
            <Skeleton className="size-[72px] shrink-0 rounded-(--radius-ctl) sm:aspect-[16/9] sm:h-auto sm:w-full sm:rounded-none" />
            <div className="flex flex-1 flex-col gap-2 pt-1 sm:p-4 sm:pt-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </LessonContent>
  );
}
