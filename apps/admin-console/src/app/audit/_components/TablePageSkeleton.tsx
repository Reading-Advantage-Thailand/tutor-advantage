import {
  CardSkeleton,
  LoadingAnnouncement,
  PageHeaderSkeleton,
  Skeleton,
  StatGridSkeleton,
  TableSkeleton,
} from "@/components/app";

/**
 * Route loading.tsx body for an A2 table page (patterns.md "Loading": the
 * TableSkeleton keeps the header and 10 row-height placeholders): page header,
 * optional KPI strip, the toolbar (count tabs + search) and the table card.
 */
export function TablePageSkeleton({
  kpis = 0,
  tabs = false,
  columns = 6,
  actions = false,
  toolbar = true,
  card = false,
}: {
  /** Cells in the KPI strip (0 = none). */
  kpis?: number;
  /** Count tabs in the toolbar. */
  tabs?: boolean;
  columns?: number;
  /** A header button (primary / export). */
  actions?: boolean;
  /** The search/filter row. */
  toolbar?: boolean;
  /** A text card between the KPI strip and the table. */
  card?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={actions} />
      {kpis > 0 ? <StatGridSkeleton count={kpis} /> : null}
      {card ? <CardSkeleton lines={2} /> : null}
      {toolbar ? (
        <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
          {tabs ? <Skeleton className="h-9 w-full max-w-md rounded-[10px] lg:w-96" /> : null}
          <Skeleton className="h-9 min-w-[200px] flex-1 rounded-(--radius-ctl)" />
          <Skeleton className="hidden h-9 w-40 rounded-(--radius-ctl) md:block" />
        </div>
      ) : null}
      <TableSkeleton columns={columns} />
    </div>
  );
}
