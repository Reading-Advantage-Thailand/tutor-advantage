import { ListGroup, LoadingAnnouncement, PageHeader, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/**
 * Placeholder with the block structure of <ClassRow> (tile, three lines, chip
 * + price; below 360px the schedule block spans the row). Server-compatible.
 */
function ClassRowSkeleton() {
  return (
    <div
      className="list-row grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 px-4 py-3.5 [--row-divider-inset:78px]"
      data-leading=""
      aria-hidden="true"
    >
      <Skeleton className="col-start-1 row-start-1 row-end-3 mt-0.5 size-12 shrink-0 rounded-[var(--radius-tile)] max-[359px]:row-end-2" />
      <div className="col-start-2 row-start-1 flex min-w-0 flex-col gap-2 pt-1">
        <Skeleton className="h-4 w-3/4 rounded-full" />
        <Skeleton className="h-3.5 w-1/2 rounded-full" />
      </div>
      <div className="col-start-2 row-start-2 flex min-w-0 flex-col gap-2 pt-2 max-[359px]:col-start-1 max-[359px]:col-end-3">
        <Skeleton className="h-3.5 w-2/3 rounded-full" />
        <div className="mt-1.5 flex items-center justify-between">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** List-area skeleton: used by the page while loading and by the route's loading.tsx. */
export function ClassListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      <LoadingAnnouncement />
      <ListGroup>
        {Array.from({ length: count }, (_, index) => (
          <ClassRowSkeleton key={index} />
        ))}
      </ListGroup>
    </>
  );
}

/**
 * Whole Classes tab while the route segment loads: same header, search,
 * level chips and invite row sizes as the page, then the rows.
 */
export function ClassesScreenSkeleton() {
  return (
    <Screen>
      <PageHeader
        title={t("classes.title")}
        subtitle={t("classes.subtitle")}
        actions={<Skeleton className="size-11 rounded-full" />}
      >
        <Skeleton className="h-[52px] w-full rounded-[var(--radius-field)]" />
        <div className="mt-3 flex gap-2 overflow-hidden py-1" aria-hidden="true">
          {[72, 52, 52, 52, 52].map((width, index) => (
            <Skeleton key={index} className="h-9 shrink-0 rounded-full" style={{ width }} />
          ))}
        </div>
      </PageHeader>
      <div className="flex flex-col gap-5 px-4 pb-6">
        <div
          aria-hidden="true"
          className="flex min-h-16 items-center gap-3.5 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-4 py-2.5 shadow-[var(--shadow-card)]"
        >
          <Skeleton className="size-12 shrink-0 rounded-[var(--radius-tile)]" />
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
