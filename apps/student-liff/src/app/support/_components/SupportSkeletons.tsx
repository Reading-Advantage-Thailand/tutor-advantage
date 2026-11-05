import { AppBar, ListGroup, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { RoomFrame } from "@/app/chat/[conversationId]/_components/RoomFrame";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "คำร้องของฉัน" placeholder: intro line, segmented control and a few rows. */
export function SupportListSkeleton() {
  return (
    <Screen>
      <AppBar title={t("support.title")} back fallbackHref="/profile" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-6" aria-hidden="true">
        <Skeleton className="h-3.5 w-4/5 rounded-full" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <ListGroup>
          <ListRowSkeleton count={3} />
        </ListGroup>
      </div>
    </Screen>
  );
}

/** New-request form placeholder: notice, category options and two fields. */
export function NewRequestSkeleton() {
  return (
    <Screen>
      <AppBar title={t("support.newTitle")} back fallbackHref="/support" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-6" aria-hidden="true">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-3.5 w-1/3 rounded-full" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-[120px] w-full rounded-xl" />
      </div>
    </Screen>
  );
}

const BUBBLES: Array<{ own: boolean; width: string; tall?: boolean }> = [
  { own: true, width: "w-3/5", tall: true },
  { own: false, width: "w-1/2" },
  { own: true, width: "w-2/5" },
];

/** Ticket detail placeholder: summary card, bubbles and the composer. */
export function TicketDetailSkeleton() {
  return (
    <RoomFrame>
      <AppBar title={<Skeleton className="h-4 w-28 rounded-full" />} back fallbackHref="/support" className="shrink-0 border-b border-hairline" />
      <LoadingAnnouncement />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pt-3 pb-4" aria-hidden="true">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="mt-auto flex flex-col gap-3">
          {BUBBLES.map((bubble, index) => (
            <div key={index} className={cn("flex", bubble.own ? "justify-end" : "justify-start")}>
              <Skeleton className={cn("rounded-[20px]", bubble.width, bubble.tall ? "h-16" : "h-10")} />
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-hairline bg-surface px-3 pt-2 pb-[max(8px,var(--safe-bottom))]">
        <div className="flex items-end gap-2" aria-hidden="true">
          <Skeleton className="h-11 flex-1 rounded-[22px]" />
          <Skeleton className="size-11 shrink-0 rounded-full" />
        </div>
      </div>
    </RoomFrame>
  );
}
