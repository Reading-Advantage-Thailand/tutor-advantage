import { HeroOverlap } from "@/components/mobile/Hero";
import { ListGroup, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { ProgressHeader } from "./ProgressHeader";

const cardClass = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 shadow-[var(--shadow-card)]";

/** Progress placeholder: hero header, stat strip, book card, week chart and lesson rows. Server-compatible. */
export function ProgressSkeleton() {
  return (
    <Screen>
      {/* No chip-row placeholder: most students have one class and one book, so there are no chips. */}
      <ProgressHeader />
      <LoadingAnnouncement />
      <HeroOverlap>
        <div className="contents" aria-hidden="true">
          <div className="grid grid-cols-3 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-1 py-3.5 shadow-[var(--shadow-card)]">
            {[0, 1, 2].map((index) => (
              <div key={index} className={`flex flex-col items-center gap-2 px-1.5 ${index ? "border-l-[1.5px] border-hairline" : ""}`}>
                <Skeleton className="h-6 w-10 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
            ))}
          </div>
          <div className={cardClass}>
            <div className="flex items-start gap-3.5">
              <Skeleton className="size-14 shrink-0 rounded-[18px]" />
              <div className="flex flex-1 flex-col gap-2 pt-1">
                <Skeleton className="h-3 w-1/3 rounded-full" />
                <Skeleton className="h-5 w-3/4 rounded-full" />
              </div>
            </div>
            <Skeleton className="mt-5 h-3 w-full rounded-full" />
            <Skeleton className="mt-4 h-12 w-full rounded-lg" />
            <Skeleton className="mt-4 h-14 w-full rounded-[20px]" />
          </div>
          <div className={cardClass}>
            <Skeleton className="h-5 w-24 rounded-full" />
            <div className="mt-4 grid h-[104px] grid-cols-7 items-end gap-2">
              {[40, 70, 30, 55, 20, 35, 25].map((height, index) => (
                <Skeleton key={index} className="w-full rounded-[10px]" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div>
            <div className="flex min-h-11 items-center">
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
            <ListGroup>
              <ListRowSkeleton count={5} />
            </ListGroup>
          </div>
        </div>
      </HeroOverlap>
    </Screen>
  );
}
