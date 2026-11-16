import { Screen } from "@/components/mobile/Screen";
import { LoadingAnnouncement } from "@/components/mobile/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Container card: rim + soft shadow, no ledge. */
const cardClass = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";

/** Static stand-in for the public app bar (back control + centred title). */
function AppBarSkeleton() {
  return (
    <div className="flex h-[calc(var(--appbar-h)+var(--safe-top))] items-center gap-3 px-3 pt-[var(--safe-top)]">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="mx-auto h-4 w-44 rounded-full" />
      <span className="size-9" />
    </div>
  );
}

/** One course card placeholder (band, level chip, title, meta, price). */
export function CourseCardSkeleton() {
  return (
    <div className={`${cardClass} relative overflow-hidden px-[18px] pt-[22px] pb-[18px]`}>
      <div className="absolute inset-x-0 top-0 h-2 bg-surface-muted" />
      <Skeleton className="h-8 w-48 rounded-full" />
      <Skeleton className="mt-3 h-6 w-2/3 rounded-full" />
      <Skeleton className="mt-2.5 h-3.5 w-1/2 rounded-full" />
      <Skeleton className="mt-2 h-3.5 w-2/5 rounded-full" />
      <Skeleton className="mt-4 h-8 w-32 rounded-full" />
    </div>
  );
}

/** /courses while the server loads the catalogue. Server-compatible. */
export function CatalogPageSkeleton() {
  return (
    <Screen>
      <AppBarSkeleton />
      <LoadingAnnouncement />
      <div aria-hidden="true" className="mx-auto w-full max-w-2xl px-4 pt-2">
        <Skeleton className="h-3.5 w-full rounded-full" />
        <Skeleton className="mt-2 h-3.5 w-4/5 rounded-full" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <CourseCardSkeleton />
          <CourseCardSkeleton />
        </div>
      </div>
    </Screen>
  );
}
