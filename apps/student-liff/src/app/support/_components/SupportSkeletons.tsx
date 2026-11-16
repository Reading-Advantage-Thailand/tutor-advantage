import { AppBar, ListGroup, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { RoomFrame } from "@/app/chat/[conversationId]/_components/RoomFrame";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** One placeholder ticket row: category tile, subject + time, "#number · category", status chip. */
function TicketRowSkeleton({ index }: { index: number }) {
  return (
    <div className="list-row flex min-h-[72px] items-start gap-3.5 px-4 py-3.5 [--row-divider-inset:78px]" data-leading="">
      <Skeleton className="mt-0.5 size-12 shrink-0 rounded-[var(--radius-tile)]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
        <div className="flex items-center gap-3">
          <Skeleton className={cn("h-4 flex-1 rounded-full", index % 2 ? "max-w-[60%]" : "max-w-[80%]")} />
          <Skeleton className="h-3 w-10 shrink-0 rounded-full" />
        </div>
        <Skeleton className="h-3 w-1/2 rounded-full" />
        <Skeleton className="mt-1 h-6 w-24 rounded-full" />
      </div>
    </div>
  );
}

/** "คำร้องของฉัน" placeholder in the final layout: help line, segmented control, ticket rows, bottom bar. */
export function SupportListSkeleton() {
  return (
    <Screen>
      <AppBar title={t("support.title")} back fallbackHref="/profile" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-5 px-4 pt-2 pb-6" aria-hidden="true">
        <div className="flex items-start gap-3.5">
          <Skeleton className="size-12 shrink-0 rounded-[var(--radius-tile)]" />
          <div className="flex flex-1 flex-col gap-2.5 pt-1.5">
            <Skeleton className="h-3.5 w-full rounded-full" />
            <Skeleton className="h-3.5 w-3/5 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-[52px] w-full rounded-full" />
        <ListGroup>
          {[0, 1, 2].map((index) => (
            <TicketRowSkeleton key={index} index={index} />
          ))}
        </ListGroup>
      </div>
    </Screen>
  );
}

/** New-request form placeholder: help line, category tiles (2 columns), notice and the two fields. */
export function NewRequestSkeleton() {
  return (
    <Screen>
      <AppBar title={t("support.newTitle")} back fallbackHref="/support" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-5 px-4 pt-2 pb-6" aria-hidden="true">
        <div className="flex items-start gap-3.5">
          <Skeleton className="size-12 shrink-0 rounded-[var(--radius-tile)]" />
          <div className="flex flex-1 flex-col gap-2.5 pt-1.5">
            <Skeleton className="h-3.5 w-full rounded-full" />
            <Skeleton className="h-3.5 w-3/5 rounded-full" />
          </div>
        </div>
        <div className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-4 shadow-[var(--shadow-card)]">
          <Skeleton className="h-4 w-1/3 rounded-full" />
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-[92px] w-full rounded-[20px]" />
            ))}
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-4 shadow-[var(--shadow-card)]">
          <Skeleton className="h-4 w-1/4 rounded-full" />
          <Skeleton className="h-[52px] w-full rounded-[var(--radius-field)]" />
          <Skeleton className="mt-2 h-4 w-1/3 rounded-full" />
          <Skeleton className="h-[120px] w-full rounded-[var(--radius-field)]" />
        </div>
      </div>
    </Screen>
  );
}

const BUBBLES: Array<{ own: boolean; width: string; tall?: boolean }> = [
  { own: true, width: "w-3/5", tall: true },
  { own: false, width: "w-1/2" },
  { own: true, width: "w-2/5" },
];

/** Ticket detail placeholder: header card, bubbles and the composer. */
export function TicketDetailSkeleton() {
  return (
    <RoomFrame>
      <AppBar title={<Skeleton className="h-4 w-28 rounded-full" />} back fallbackHref="/support" className="shrink-0 border-b-[1.5px] border-clay-rim" />
      <LoadingAnnouncement />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pt-3 pb-4" aria-hidden="true">
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-4 shadow-[var(--shadow-card)]">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-5 w-4/5 rounded-full" />
          <Skeleton className="h-14 w-full rounded-[16px]" />
        </div>
        <div className="mt-auto flex flex-col gap-3">
          {BUBBLES.map((bubble, index) => (
            <div key={index} className={cn("flex", bubble.own ? "justify-end" : "justify-start")}>
              <Skeleton className={cn("rounded-[18px]", bubble.width, bubble.tall ? "h-16" : "h-11")} />
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t-[1.5px] border-clay-rim bg-[var(--surface-nav)] px-3 pt-2.5 pb-[max(10px,var(--safe-bottom))]">
        <div className="flex items-end gap-2" aria-hidden="true">
          <Skeleton className="h-[52px] flex-1 rounded-[var(--radius-field)]" />
          <Skeleton className="mb-1 size-11 shrink-0 rounded-full" />
        </div>
      </div>
    </RoomFrame>
  );
}
