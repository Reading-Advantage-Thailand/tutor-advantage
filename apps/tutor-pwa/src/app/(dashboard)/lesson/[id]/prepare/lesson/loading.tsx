import { LoadingAnnouncement, Skeleton } from "@/components/app/Skeletons";

/** Mirrors the rehearsal stage: phase progress strip, two-column stage, control dock. */
export default function PrepareLessonLoading() {
  return (
    <div className="flex min-h-(--lesson-viewport-h) w-full flex-col gap-4 px-3 pt-3 sm:px-4 lg:px-6">
      <LoadingAnnouncement />
      <Skeleton className="h-20 rounded-xl" />
      <div aria-hidden="true" className="mx-auto grid w-full max-w-6xl flex-1 gap-6 py-4 lg:grid-cols-[45%_1fr]">
        <Skeleton className="h-64 rounded-xl lg:h-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-14 rounded-none" />
    </div>
  );
}
