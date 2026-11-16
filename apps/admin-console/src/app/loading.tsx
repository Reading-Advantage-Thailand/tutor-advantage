import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton, TableSkeleton } from "@/components/app";

/**
 * Default route loading state, shaped like the A2 table page that most routes
 * are (patterns.md "Loading", admin): page header, the count-tab + search +
 * "คอลัมน์" toolbar, and the table card with 10 row-height placeholders.
 * Segments with a different shape add their own loading.tsx.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <div aria-hidden="true" className="flex flex-wrap items-center gap-2 md:flex-nowrap">
        <Skeleton className="h-9 w-full rounded-(--radius-ctl) md:w-80 md:shrink-0" />
        <Skeleton className="h-9 min-w-0 flex-1 rounded-(--radius-ctl)" />
        <Skeleton className="hidden h-9 w-28 shrink-0 rounded-(--radius-ctl) md:block" />
      </div>
      <TableSkeleton rows={10} columns={5} />
    </div>
  );
}
