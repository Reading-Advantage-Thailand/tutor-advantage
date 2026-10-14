import { LoadingAnnouncement, Skeleton } from "@/components/app";

/** Room skeleton: header, a few bubbles and the composer, same frame as the room. */
export default function ChatRoomLoading() {
  return (
    <div
      aria-hidden="true"
      data-chat-room=""
      className="flex flex-col bg-app max-md:-mx-[max(var(--gutter),var(--safe-left))] max-md:-mt-4 max-md:-mb-6 max-md:min-h-[calc(100dvh-var(--appbar-h)-var(--safe-top))] md:h-[calc(100dvh-64px)] md:overflow-hidden md:rounded-xl md:border md:border-hairline md:bg-surface md:shadow-card xl:h-[calc(100dvh-76px)]"
    >
      <LoadingAnnouncement />
      <div className="hidden items-center gap-3 border-b border-hairline px-4 py-3 md:flex">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3 px-4 py-4 md:bg-app">
        <Skeleton className="h-10 w-2/3 rounded-[20px]" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-[20px]" />
        <Skeleton className="h-14 w-3/5 rounded-[20px]" />
        <Skeleton className="ml-auto h-10 w-2/5 rounded-[20px]" />
      </div>
      <div className="flex items-center gap-2 border-t border-hairline px-3 py-2 md:px-4 md:py-3">
        <Skeleton className="h-11 flex-1 rounded-[22px] md:h-10" />
        <Skeleton className="size-11 rounded-full md:size-10" />
      </div>
    </div>
  );
}
