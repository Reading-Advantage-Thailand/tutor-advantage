import { LoadingAnnouncement, PageHeaderSkeleton, Skeleton, SkeletonText } from "@/components/app";

/** One fieldset card skeleton: tone tile + section title + helper, then fields. */
function SectionSkeleton({ fields = 2, tall }: { fields?: number; tall?: boolean }) {
  return (
    <div aria-hidden="true" className="ds-card flex flex-col gap-4 p-4 sm:p-5 md:p-6">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-(--radius-tile)" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-4.5 w-40" />
          <Skeleton className="h-3.5 w-64 max-w-full" />
        </div>
      </div>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-11 w-full rounded-(--radius-field)" />
        </div>
      ))}
      {tall ? <SkeletonText lines={4} /> : null}
    </div>
  );
}

/** Mirrors the new-class form: header, then the four fieldset cards (max 720). */
export default function NewClassLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <div className="flex flex-col gap-4 md:gap-5">
        <SectionSkeleton fields={2} />
        <SectionSkeleton fields={1} />
        <SectionSkeleton fields={1} tall />
        <SectionSkeleton fields={1} />
      </div>
    </div>
  );
}
