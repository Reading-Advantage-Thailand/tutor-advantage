import { LoadingAnnouncement, PageHeader, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** Placeholder with the exact block structure of <ClassCard>. Server-compatible. */
export function ClassCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <Skeleton className="h-5 w-3/4 rounded-full" />
      <div className="mt-2.5 flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-3.5 w-1/3 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-3.5 w-2/3 rounded-full" />
      <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="ml-auto h-6 w-24 rounded-full" />
      </div>
    </div>
  );
}

/** List-area skeleton: used by the page while loading and by the route's loading.tsx. */
export function ClassListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <LoadingAnnouncement />
      {Array.from({ length: count }, (_, index) => (
        <ClassCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * Whole Classes tab while the route segment loads: same header, search,
 * level chips and invite row sizes as the page, then the card skeletons.
 */
export function ClassesScreenSkeleton() {
  return (
    <Screen>
      <PageHeader
        title={t("classes.title")}
        subtitle={t("classes.subtitle")}
        actions={<Skeleton className="size-11 rounded-full" />}
      >
        <Skeleton className="h-11 w-full rounded-full" />
        <div className="mt-3 flex gap-2 overflow-hidden py-1" aria-hidden="true">
          {[72, 52, 52, 52, 52].map((width, index) => (
            <Skeleton key={index} className="h-10 shrink-0 rounded-full" style={{ width }} />
          ))}
        </div>
      </PageHeader>
      <div className="flex flex-col gap-4 px-4 pb-6">
        <div
          aria-hidden="true"
          className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface px-4 py-2.5 shadow-[var(--shadow-card)]"
        >
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2 rounded-full" />
            <Skeleton className="h-3 w-2/3 rounded-full" />
          </div>
        </div>
        <ClassListSkeleton />
      </div>
    </Screen>
  );
}
