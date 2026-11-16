import { AppBar, ListGroup, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** Calendar card + agenda placeholder (no event dots), for loading.tsx and the page's loading branch. */
export function ScheduleSkeleton() {
  return (
    <Screen>
      <AppBar title={t("schedule.title")} back fallbackHref="/dashboard" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-5 px-4 pt-2 pb-6" aria-hidden="true">
        <div className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-3 shadow-[var(--shadow-card)] max-[359px]:-mx-4 max-[359px]:rounded-none max-[359px]:border-x-0 max-[359px]:px-0.5">
          <div className="flex min-h-12 items-center justify-between pl-2">
            <Skeleton className="h-5 w-36 rounded-full" />
            <div className="flex gap-1">
              <Skeleton className="size-11 rounded-full" />
              <Skeleton className="size-11 rounded-full" />
            </div>
          </div>
          <div className="mt-1 grid grid-cols-7 gap-y-0.5">
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
          <div className="flex min-h-11 items-center">
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
          <ListGroup>
            <ListRowSkeleton count={2} />
          </ListGroup>
        </div>
      </div>
    </Screen>
  );
}
