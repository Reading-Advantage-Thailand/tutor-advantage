import { AppBar, CardSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** Result detail placeholder in the final layout (loading.tsx + the page's loading branch). */
export function DetailSkeleton() {
  return (
    <Screen>
      <AppBar title={t("lessonHistory.summaryTitle")} back fallbackHref="/lesson/history" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-5 px-4 pt-3 pb-8" aria-hidden="true">
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-5">
          <Skeleton className="h-6 w-4/5 rounded-full" />
          <Skeleton className="h-3.5 w-1/2 rounded-full" />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Skeleton className="h-[72px] rounded-2xl" />
            <Skeleton className="h-[72px] rounded-2xl" />
          </div>
        </div>
        <Skeleton className="h-5 w-40 rounded-full" />
        <CardSkeleton media={false} lines={3} />
        <CardSkeleton media={false} lines={3} />
      </div>
    </Screen>
  );
}
