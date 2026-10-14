import { LoadingAnnouncement, Skeleton } from "@/components/app/Skeletons";

export default function LessonLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 md:px-6">
      <LoadingAnnouncement />
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </div>
  );
}
