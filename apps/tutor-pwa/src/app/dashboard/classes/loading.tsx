import { ListSkeleton, LoadingAnnouncement, PageHeaderSkeleton, Skeleton, TableSkeleton } from "@/components/app";

/** Mirrors the classes list: header, toolbar, group title, then rows (phone) or the table (desktop). */
export default function ClassesLoading() {
  return (
    <div className="mx-auto flex w-full flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <div aria-hidden="true" className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
        <Skeleton className="h-11 w-full rounded-(--radius-ctl) md:max-w-sm" />
        <Skeleton className="h-11 w-full rounded-(--radius-ctl) md:w-64" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="my-3 h-5 w-40" />
        <ListSkeleton rows={5} className="lg:hidden" />
        <TableSkeleton rows={6} columns={4} className="hidden lg:block" />
      </div>
    </div>
  );
}
