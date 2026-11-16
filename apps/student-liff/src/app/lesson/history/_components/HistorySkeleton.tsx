import { AppBar, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** History list placeholder in the final layout (loading.tsx + the page's loading branch): stat strip, then one card of day captions and rows. */
export function HistorySkeleton() {
  return (
    <Screen>
      <AppBar title={t("lessonHistory.title")} back fallbackHref="/dashboard" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-5 px-4 pt-3 pb-8" aria-hidden="true">
        <div className="grid grid-cols-3 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-1 py-3.5 shadow-[var(--shadow-card)]">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className={`flex flex-col items-center gap-2 px-1.5 ${index > 0 ? "border-l-[1.5px] border-hairline" : ""}`}
            >
              <Skeleton className="h-6 w-10 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]">
          <div className="bg-surface-muted px-4 py-2.5">
            <Skeleton className="h-3.5 w-20 rounded-full" />
          </div>
          <ListRowSkeleton count={2} />
          <div className="border-t-[1.5px] border-hairline bg-surface-muted px-4 py-2.5">
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </div>
          <ListRowSkeleton count={2} />
        </div>
      </div>
    </Screen>
  );
}
