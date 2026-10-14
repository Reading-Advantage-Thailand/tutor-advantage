import { AppBar, BottomActionBar, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

function StepSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
      <Skeleton className="h-4 w-20 rounded-full" />
      <Skeleton className="h-3.5 w-1/2 rounded-full" />
      <Skeleton className={tall ? "h-[104px] w-full rounded-xl" : "h-12 w-full rounded-xl"} />
    </div>
  );
}

/** Guardian form placeholder: intro, three step cards and the bottom save bar. */
export function GuardianSkeleton() {
  return (
    <Screen>
      <AppBar title={t("guardian.title")} back fallbackHref="/profile" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-6" aria-hidden="true">
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-4">
          <Skeleton className="size-12 shrink-0 rounded-[14px]" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3 rounded-full" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        </div>
        <StepSkeleton />
        <StepSkeleton tall />
        <StepSkeleton />
      </div>
      <BottomActionBar>
        <Skeleton className="h-[52px] flex-1 rounded-2xl" />
      </BottomActionBar>
    </Screen>
  );
}
