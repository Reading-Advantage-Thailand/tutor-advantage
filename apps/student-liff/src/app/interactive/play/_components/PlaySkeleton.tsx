import { AppBar, LoadingAnnouncement, Screen, Skeleton, SkeletonText, Spinner } from "@/components/mobile";
import { t } from "@/lib/i18n";

/**
 * Live-lesson placeholder in the final layout: top bar + progress, a phase
 * card and two answer rows. Used by loading.tsx, the Suspense fallback, the
 * LIFF start-up branch and while the lesson socket connects.
 * `status` shows a short visible line (e.g. "กำลังเชื่อมต่อบทเรียน").
 */
export function PlaySkeleton({ status }: { status?: string }) {
  return (
    <Screen>
      <AppBar
        title={t("interactivePlay.topBarTitle")}
        bottom={<Skeleton className="h-1.5 w-full rounded-full" />}
      />
      {status ? null : <LoadingAnnouncement />}
      <div className="flex flex-1 flex-col items-center px-4 pt-4 pb-[calc(24px+var(--safe-bottom))]">
        <div className="flex w-full max-w-md flex-col gap-3">
          {status ? (
            <p role="status" className="flex items-center justify-center gap-2 py-1 text-sm leading-[1.5] font-semibold text-fg-muted">
              <Spinner size="sm" className="text-brand-fg" />
              {status}
            </p>
          ) : null}
          <div aria-hidden="true" className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
            <Skeleton className="size-16 rounded-2xl" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-6 w-1/2 rounded-full" />
            <SkeletonText lines={2} className="w-full" />
          </div>
          <div aria-hidden="true" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-4">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2 rounded-full" />
              <Skeleton className="h-3 w-1/3 rounded-full" />
            </div>
          </div>
          <div aria-hidden="true" className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    </Screen>
  );
}
