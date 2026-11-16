import { AppBar, BottomActionBar, ListGroup, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** The enroll app bar: back goes to the previous screen, or Home for a deep link. */
export function EnrollAppBar() {
  return <AppBar title={t("enroll.title")} back fallbackHref="/dashboard" />;
}

/**
 * Loading state for /enroll (Suspense fallback, route loading.tsx, LIFF
 * start-up and the details request), shaped like the confirm step: class
 * hero, details list, seats card, student row, bottom bar.
 */
export function EnrollSkeleton({ label }: { label?: string }) {
  return (
    <Screen>
      <EnrollAppBar />
      <LoadingAnnouncement label={label} />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-2 pb-6" aria-hidden="true">
        <div className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface-muted p-5">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="mt-4 h-7 w-3/4 rounded-full" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
        <ListGroup>
          <ListRowSkeleton count={4} />
        </ListGroup>
        <div className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-[18px] shadow-[var(--shadow-card)]">
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-24 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-3 w-full rounded-full" />
        </div>
        <ListGroup>
          <ListRowSkeleton count={1} />
        </ListGroup>
      </div>
      <BottomActionBar>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-12 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <Skeleton className="h-14 flex-1 rounded-[20px]" />
      </BottomActionBar>
    </Screen>
  );
}
