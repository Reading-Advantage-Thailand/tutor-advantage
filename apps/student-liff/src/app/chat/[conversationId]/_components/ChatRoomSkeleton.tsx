import { AppBar, LoadingAnnouncement, Skeleton } from "@/components/mobile";
import { cn } from "@/lib/utils";
import { RoomFrame } from "./RoomFrame";

const BUBBLES: Array<{ own: boolean; width: string; tall?: boolean }> = [
  { own: false, width: "w-3/5" },
  { own: false, width: "w-2/5", tall: true },
  { own: true, width: "w-1/2" },
  { own: false, width: "w-2/3" },
  { own: true, width: "w-2/5", tall: true },
];

/** Chat room loading screen: header, alternating bubbles and the composer (route loading.tsx + page loading branch). */
export function ChatRoomSkeleton() {
  return (
    <RoomFrame>
      <AppBar
        title={
          <span className="inline-flex items-center gap-2 align-middle">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-28 rounded-full" />
          </span>
        }
        back
        fallbackHref="/chat"
        className="shrink-0 border-b-[1.5px] border-clay-rim"
      />
      <LoadingAnnouncement />
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden px-4 pb-4" aria-hidden="true">
        {BUBBLES.map((bubble, index) => (
          <div key={index} className={cn("flex items-end gap-2", bubble.own ? "justify-end" : "justify-start")}>
            {bubble.own ? null : <Skeleton className="size-8 shrink-0 rounded-full" />}
            <Skeleton className={cn("rounded-[18px]", bubble.width, bubble.tall ? "h-16" : "h-11")} />
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t-[1.5px] border-clay-rim bg-[var(--surface-nav)] px-3 pt-2.5 pb-[max(10px,var(--safe-bottom))]">
        <div className="flex items-end gap-2.5" aria-hidden="true">
          <Skeleton className="h-[52px] flex-1 rounded-[var(--radius-field)]" />
          <Skeleton className="mb-1 size-11 shrink-0 rounded-full" />
        </div>
      </div>
    </RoomFrame>
  );
}
