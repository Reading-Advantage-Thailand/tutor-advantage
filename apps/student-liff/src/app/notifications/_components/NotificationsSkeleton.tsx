import { AppBar, ListGroup, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** One switch row placeholder: tile, title + subtitle, the 52×32 switch. */
function SwitchRowSkeleton({ index }: { index: number }) {
  return (
    <div className="list-row flex min-h-16 items-center gap-3.5 px-4 py-2.5" data-leading="" aria-hidden="true">
      <Skeleton className="size-10 shrink-0 rounded-[12px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className={index % 2 ? "h-4 w-1/2 rounded-full" : "h-4 w-2/3 rounded-full"} />
        <Skeleton className="h-3 w-3/5 rounded-full" />
      </div>
      <Skeleton className="h-8 w-[52px] shrink-0 rounded-full" />
    </div>
  );
}

/** Notification settings placeholder: helper line, LINE status card and the three switch groups. */
export function NotificationsSkeleton() {
  return (
    <Screen>
      <AppBar title={t("notifications.title")} back fallbackHref="/profile" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-6 px-4 pt-2 pb-6" aria-hidden="true">
        <Skeleton className="h-4 w-3/4 rounded-full" />
        <div className="flex gap-3 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-3.5 py-3">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2 rounded-full" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
          </div>
        </div>
        {[3, 1, 1].map((rows, groupIndex) => (
          <div key={groupIndex} className="flex flex-col gap-2">
            <Skeleton className="ml-4 h-3 w-20 rounded-full" />
            <ListGroup>
              {Array.from({ length: rows }, (_, index) => (
                <SwitchRowSkeleton key={index} index={index} />
              ))}
            </ListGroup>
          </div>
        ))}
      </div>
    </Screen>
  );
}
