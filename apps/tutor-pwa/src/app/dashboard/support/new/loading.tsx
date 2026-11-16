import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

/** Mirrors the new-ticket form: privacy notice, category tiles, the details card. */
export default function NewTicketLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <Skeleton className="h-20 w-full rounded-(--radius-card)" />
      <div aria-hidden="true" className="rounded-(--radius-card) border border-clay-rim bg-surface p-4 md:p-5">
        <Skeleton className="h-5 w-28" />
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex min-h-24 flex-col gap-2 rounded-(--radius-card) border border-clay-rim p-3">
              <Skeleton className="size-10 rounded-(--radius-tile)" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-4 rounded-(--radius-card) border border-clay-rim bg-surface p-4 md:p-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className={i === 2 ? "h-36 w-full rounded-(--radius-field)" : "h-11 w-full rounded-(--radius-field)"} />
          </div>
        ))}
      </div>
    </div>
  );
}
