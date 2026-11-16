import { AppBar, LoadingAnnouncement, ListGroup, ListRowSkeleton, Screen, Skeleton, SkeletonText } from "@/components/mobile";
import { t } from "@/lib/i18n";

const card = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";

/** Reader placeholder in the final layout: hero card, notice, passage card, vocabulary rows. */
export function ReaderSkeleton() {
  return (
    <Screen>
      <AppBar title={t("articleReader.articleTitle")} back fallbackHref="/progress" />
      <LoadingAnnouncement />
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 pt-3 pb-10" aria-hidden="true">
        <div className="flex flex-col gap-3.5">
          <div className={`${card} px-[18px] pt-4 pb-[18px]`}>
            <div className="flex items-start gap-3.5">
              <Skeleton className="size-14 shrink-0 rounded-[18px]" />
              <div className="flex flex-1 flex-col gap-2.5 pt-1">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-4/5 rounded-full" />
              </div>
            </div>
            <Skeleton className="mt-4 h-11 w-full rounded-[var(--radius-ctl-sm)]" />
          </div>
          <Skeleton className="h-[72px] w-full rounded-[var(--radius-card)]" />
          <div className={`${card} flex flex-col gap-4 px-[18px] py-5`}>
            <SkeletonText lines={5} />
            <SkeletonText lines={4} />
          </div>
        </div>
        <ListGroup>
          <ListRowSkeleton count={3} />
        </ListGroup>
      </div>
    </Screen>
  );
}
