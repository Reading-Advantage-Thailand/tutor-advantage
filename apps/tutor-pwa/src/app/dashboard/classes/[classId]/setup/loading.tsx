import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton } from "@/components/app";

/** Mirrors the setup form: header, intro notice and the three numbered step cards. */
export default function ClassSetupLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <Skeleton className="h-14 w-full rounded-(--radius-card)" />
      {[2, 2, 6].map((fields, index) => (
        <div key={index} aria-hidden="true" className="ds-card flex flex-col gap-4 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-(--radius-tile)" />
            <Skeleton className="h-5 w-40" />
          </div>
          {Array.from({ length: fields }, (_, field) => (
            <Skeleton key={field} className="h-11 w-full rounded-(--radius-ctl)" />
          ))}
        </div>
      ))}
    </div>
  );
}
