import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton, TableSkeleton } from "@/components/app";

/** Mirrors the users page: header, count-tab toolbar, table card (patterns.md "Loading"). */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full flex-col gap-5">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full rounded-(--radius-ctl) lg:w-[25rem]" />
        <Skeleton className="h-9 min-w-[200px] flex-1 rounded-(--radius-ctl)" />
        <Skeleton className="hidden h-9 w-40 rounded-(--radius-ctl) md:block" />
        <Skeleton className="hidden h-9 w-40 rounded-(--radius-ctl) md:block" />
        <Skeleton className="h-9 w-28 rounded-(--radius-ctl)" />
      </div>
      <TableSkeleton columns={6} />
    </div>
  );
}
