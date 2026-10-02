import { AppBar, ListGroup, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** Calendar card + agenda placeholder (no event dots), for loading.tsx and the page's loading branch. */
export function ScheduleSkeleton() {
  return (
    <Screen>
      <AppBar title={t("schedule.title")} back fallbackHref="/dashboard" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-5 px-4 pt-2 pb-6" aria-hidden="true">
        <div className="rounded-[var(--radius-card)] border border-hairline bg-surface p-2 shadow-[var(--shadow-card)]">
          <div className="flex h-12 items-center justify-between pr-1 pl-2">
            <Skeleton className="h-4 w-32 rounded-full" />
            <div className="flex gap-2">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="size-9 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={`h-${index}`} className="flex h-8 items-center justify-center">
                <Skeleton className="h-3 w-4 rounded-full" />
              </div>
            ))}
            {Array.from({ length: 42 }, (_, index) => (
              <div key={index} className="flex h-11 items-center justify-center">
                <Skeleton className="size-7 rounded-full opacity-60" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex min-h-11 items-center px-1">
            <Skeleton className="h-4 w-28 rounded-full" />
          </div>
          <ListGroup>
            <ListRowSkeleton count={2} />
          </ListGroup>
        </div>
      </div>
    </Screen>
  );
}
