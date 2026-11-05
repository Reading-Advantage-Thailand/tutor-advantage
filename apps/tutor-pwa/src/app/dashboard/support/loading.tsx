import { ListSkeleton, LoadingAnnouncement, PageHeaderSkeleton } from "@/components/app";

export default function SupportLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <ListSkeleton rows={4} leading />
    </div>
  );
}
