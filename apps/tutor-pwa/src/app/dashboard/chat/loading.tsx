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
      <div aria-hidden="true" className="ds-card hidden h-[calc(100dvh-64px)] flex-col items-center justify-center gap-4 lg:flex xl:h-[calc(100dvh-76px)]">
        <Skeleton className="size-12 rounded-(--radius-tile)" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-64" />
      </div>
    </>
  );
}
