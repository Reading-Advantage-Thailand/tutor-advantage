import { AppBar, BottomActionBar, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

function StepSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <Skeleton className="h-3.5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-1/2 rounded-full" />
      {tall ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14 rounded-[var(--radius-ctl)]" />
          ))}
        </div>
      ) : (
        <Skeleton className="h-[52px] w-full rounded-[var(--radius-field)]" />
      )}
    </div>
  );
}

/** Guardian form placeholder: intro, three step cards and the bottom save bar. */
export function GuardianSkeleton() {
  return (
    <Screen>
      <AppBar title={t("guardian.title")} back fallbackHref="/profile" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-4 px-4 pt-3 pb-6" aria-hidden="true">
        <div className="flex items-start gap-4 rounded-[var(--radius-card)] border-[1.5px] border-brand-soft-border bg-brand-soft p-5">
          <Skeleton className="size-14 shrink-0 rounded-[18px]" />
          <div className="flex flex-1 flex-col gap-2.5 pt-1">
            <Skeleton className="h-5 w-2/3 rounded-full" />
            <Skeleton className="h-3.5 w-full rounded-full" />
            <Skeleton className="h-3.5 w-4/5 rounded-full" />
          </div>
        </div>
        <StepSkeleton />
        <StepSkeleton tall />
        <StepSkeleton />
      </div>
      <BottomActionBar>
        <Skeleton className="h-14 flex-1 rounded-[20px]" />
      </BottomActionBar>
    </Screen>
  );
}
