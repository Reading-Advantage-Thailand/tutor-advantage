import { CardSkeleton, LoadingAnnouncement, PageHeaderSkeleton } from "@/components/app/Skeletons";

export default function DemoLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:gap-8">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={3} />
    </div>
  );
}
