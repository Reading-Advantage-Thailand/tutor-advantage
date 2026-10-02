import { CardSkeleton, LoadingAnnouncement, PageHeaderSkeleton } from "@/components/app";

export default function NewClassLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 lg:gap-8">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={6} />
    </div>
  );
}
