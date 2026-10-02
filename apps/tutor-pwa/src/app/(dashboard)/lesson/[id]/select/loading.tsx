import { LessonContent } from "@/components/app/LessonShell";
import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app/Skeletons";

export default function SelectLessonLoading() {
  return (
    <LessonContent width="wide" className="gap-4 md:gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Skeleton className="h-10 rounded-lg md:max-w-md" />
        <Skeleton className="h-9 rounded-lg md:ml-auto md:w-72" />
      </div>
      <div aria-hidden="true" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-hairline bg-surface p-3">
            <Skeleton className="size-16 shrink-0 rounded-lg md:size-[72px]" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
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
