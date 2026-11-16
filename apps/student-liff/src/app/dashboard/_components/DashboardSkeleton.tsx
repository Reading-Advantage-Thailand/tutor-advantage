import type { ReactNode } from "react";
import { LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { HERO_CLASS, HeroChipsPlaceholder, HeroReedyPlaceholder } from "./DashboardHero";

const cardClass = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";
/** Placeholder bars on the hero use the hero chip colour (they sit on the flat hero, not on paper). */
const heroBar = "rounded-full bg-hero-chip";

function HeroSkeleton() {
  return (
    <header className={HERO_CLASS} aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
          <div className={`h-4 w-28 ${heroBar}`} />
          <div className={`mb-2.5 h-8 w-44 ${heroBar}`} />
        </div>
        <div className="mt-1 size-[52px] shrink-0 rounded-full bg-hero-chip ring-[3px] ring-surface" />
      </div>
      <HeroChipsPlaceholder />
      <HeroReedyPlaceholder />
    </header>
  );
}

/**
 * Home placeholder shaped like the final layout (patterns.md S1): hero with
 * Reedy's row, the next card overlapping it, the quick menu's four tiles and
 * the class list. Used by loading.tsx and by the page while LIFF starts / the
 * summary loads (pass the real `hero` once the profile is known).
 * Server-compatible.
 */
export function DashboardSkeleton({ hero }: { hero?: ReactNode }) {
  return (
    <Screen>
      {hero ?? <HeroSkeleton />}
      <LoadingAnnouncement />
      <div className="relative z-[3] -mt-[30px] flex flex-col gap-[22px] px-4 pb-6" aria-hidden="true">
        <div className={`${cardClass} px-[18px] pt-[18px] pb-5`}>
          <div className="flex items-center gap-3.5">
            <Skeleton className="size-14 shrink-0 rounded-[18px]" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-28 rounded-full" />
              <Skeleton className="h-6 w-2/3 rounded-full" />
              <Skeleton className="h-3.5 w-24 rounded-full" />
            </div>
          </div>
          <div className="mt-5 mb-2.5 flex justify-between">
            <Skeleton className="h-3.5 w-24 rounded-full" />
            <Skeleton className="h-3.5 w-10 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="mt-[18px] h-14 w-full rounded-[20px]" />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex flex-col items-center gap-2 pt-1">
              <Skeleton className="size-[60px] rounded-[20px]" />
              <Skeleton className="h-3.5 w-10 rounded-full" />
              <Skeleton className="h-3.5 w-12 rounded-full" />
            </div>
          ))}
        </div>

        <section>
          <div className="flex min-h-11 items-center justify-between">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
            {[0, 1].map((index) => (
              <div key={index} className={`${cardClass} flex min-h-[76px] items-center gap-3.5 py-3.5 pr-3 pl-[18px]`}>
                <Skeleton className="size-10 shrink-0 rounded-[12px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/2 rounded-full" />
                  <Skeleton className="h-3 w-2/3 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Screen>
  );
}
