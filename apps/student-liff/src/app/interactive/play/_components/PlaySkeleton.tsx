import { LoadingAnnouncement, Screen, Skeleton, Spinner } from "@/components/mobile";
import { t } from "@/lib/i18n";

const card = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";

/**
 * Live-lesson placeholder in the final layout (patterns.md S6): the lesson bar
 * (close · "ห้องเรียนสด" · score pill), the phase row with its journey, a
 * question card, the 2×2 answer tiles and the rank strip. Used by
 * loading.tsx, the Suspense fallback, the LIFF start-up branch and while the
 * lesson socket connects. `status` shows a short visible line (e.g.
 * "กำลังเชื่อมต่อบทเรียน").
 */
export function PlaySkeleton({ status }: { status?: string }) {
  return (
    <Screen>
      <header className="appbar border-b-[1.5px] border-clay-rim" data-variant="solid">
        <div className="grid h-[60px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
          <Skeleton aria-hidden="true" className="size-9 rounded-full" />
          <h1 className="truncate text-center font-heading text-[17px] leading-[1.35] font-semibold text-fg">
            {t("interactivePlay.topBarTitle")}
          </h1>
          <Skeleton aria-hidden="true" className="ml-auto h-9 w-[68px] rounded-full" />
        </div>
      </header>
      {status ? null : <LoadingAnnouncement />}
      <div className="flex flex-1 flex-col items-center px-4 pt-3.5 pb-[calc(16px+var(--safe-bottom))]">
        <div className="flex w-full max-w-[560px] flex-1 flex-col gap-3.5">
          <div aria-hidden="true">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 shrink-0 rounded-[var(--radius-tile)]" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-16 rounded-full" />
                <Skeleton className="h-4 w-1/2 rounded-full" />
              </div>
            </div>
            <Skeleton className="mt-3 h-2 w-full rounded-full" />
          </div>
          {status ? (
            <p role="status" className="flex items-center justify-center gap-2 py-0.5 text-sm leading-[1.6] font-semibold text-fg-muted">
              <Spinner size="sm" className="text-brand-fg" />
              {status}
            </p>
          ) : null}
          <div aria-hidden="true" className={`${card} flex flex-col gap-3 px-[18px] py-4`}>
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-5 w-4/5 rounded-full" />
            <Skeleton className="h-5 w-3/5 rounded-full" />
            <Skeleton className="h-3 w-2/3 rounded-full" />
          </div>
          <div aria-hidden="true" className="grid min-h-[260px] flex-1 grid-cols-2 gap-x-3 gap-y-4">
            <Skeleton className="min-h-[120px] rounded-[var(--radius-answer)]" />
            <Skeleton className="min-h-[120px] rounded-[var(--radius-answer)]" />
            <Skeleton className="min-h-[120px] rounded-[var(--radius-answer)]" />
            <Skeleton className="min-h-[120px] rounded-[var(--radius-answer)]" />
          </div>
          <div aria-hidden="true" className={`${card} flex items-center gap-3 rounded-[20px] py-2 pr-3.5 pl-2`}>
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2 rounded-full" />
              <Skeleton className="h-3 w-1/4 rounded-full" />
            </div>
            <Skeleton className="size-9 shrink-0 rounded-full" />
          </div>
        </div>
      </div>
    </Screen>
  );
}
