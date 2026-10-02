import { AppBar, ListGroup, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** History list placeholder in the final layout (loading.tsx + the page's loading branch). */
export function HistorySkeleton() {
  return (
    <Screen>
      <AppBar title={t("lessonHistory.title")} back fallbackHref="/dashboard" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-5 px-4 pt-3 pb-8" aria-hidden="true">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-hairline bg-surface p-3">
              <Skeleton className="size-8 rounded-[10px]" />
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-3 w-14 rounded-full" />
            </div>
          ))}
        </div>
        <div>
          <Skeleton className="mb-3 ml-4 h-3.5 w-24 rounded-full" />
          <ListGroup>
            <ListRowSkeleton count={4} />
          </ListGroup>
        </div>
      </div>
    </Screen>
  );
}
