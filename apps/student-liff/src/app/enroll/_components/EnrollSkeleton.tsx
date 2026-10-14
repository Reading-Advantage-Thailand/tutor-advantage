import { AppBar, BottomActionBar, ListGroup, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** The enroll app bar: back goes to the previous screen, or Home for a deep link. */
export function EnrollAppBar() {
  return <AppBar title={t("enroll.title")} back fallbackHref="/dashboard" />;
}

/**
 * Loading state for /enroll (Suspense fallback, route loading.tsx, LIFF
 * start-up and the details request): hero, details list, bottom bar.
 */
export function EnrollSkeleton({ label }: { label?: string }) {
  return (
    <Screen>
      <EnrollAppBar />
      <LoadingAnnouncement label={label} />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-6" aria-hidden="true">
        <div className="rounded-[var(--radius-card)] bg-fill-muted p-5">
          <Skeleton className="h-[30px] w-28 rounded-full" />
          <Skeleton className="mt-4 h-6 w-3/4 rounded-full" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-[30px] w-20 rounded-full" />
            <Skeleton className="h-[30px] w-16 rounded-full" />
          </div>
        </div>
        <ListGroup>
          <ListRowSkeleton count={4} />
        </ListGroup>
        <ListGroup>
          <ListRowSkeleton count={1} />
        </ListGroup>
      </div>
      <BottomActionBar>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-12 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-[52px] flex-1 rounded-2xl" />
      </BottomActionBar>
    </Screen>
  );
}
