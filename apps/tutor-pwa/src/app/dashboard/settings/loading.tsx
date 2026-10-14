import {
  CardSkeleton,
  ListSkeleton,
  LoadingAnnouncement,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/app/Skeletons";

export default function SettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 lg:gap-8">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        <CardSkeleton lines={2} />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-48" />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
      <ListSkeleton rows={2} />
    </div>
  );
}
