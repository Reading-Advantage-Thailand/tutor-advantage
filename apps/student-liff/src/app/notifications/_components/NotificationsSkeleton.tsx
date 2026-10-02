import { AppBar, ListGroup, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** Notification settings placeholder: helper line, LINE status card and three switch groups. */
export function NotificationsSkeleton() {
  return (
    <Screen>
      <AppBar title={t("notifications.title")} back fallbackHref="/profile" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-6 px-4 pt-2 pb-6" aria-hidden="true">
        <Skeleton className="h-3.5 w-3/4 rounded-full" />
        <div className="flex gap-3 rounded-2xl border border-hairline bg-surface p-4">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2 rounded-full" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
          </div>
        </div>
        {[1, 3, 1].map((rows, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="ml-4 h-3 w-20 rounded-full" />
            <ListGroup>
              <ListRowSkeleton count={rows} />
            </ListGroup>
          </div>
        ))}
      </div>
    </Screen>
  );
}
