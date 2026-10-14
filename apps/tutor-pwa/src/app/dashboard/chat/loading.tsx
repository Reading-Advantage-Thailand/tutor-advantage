import { ListSkeleton, LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

/** List page skeleton (phones/tablets); on desktop the layout's list pane is already visible. */
export default function ChatLoading() {
  return (
    <>
      <LoadingAnnouncement />
      <div className="mx-auto flex w-full max-w-[1024px] flex-col gap-6 lg:hidden">
        <PageHeaderSkeleton actions={false} />
        <ListSkeleton rows={6} leading />
      </div>
      <div aria-hidden="true" className="hidden h-[calc(100dvh-64px)] items-center justify-center rounded-xl border border-hairline bg-surface lg:flex xl:h-[calc(100dvh-76px)]">
        <Skeleton className="h-4 w-40" />
      </div>
    </>
  );
}
