import type { ReactNode } from "react";
import { LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { HERO_CLASS, HeroChipsPlaceholder } from "./DashboardHero";

const cardClass = "rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)]";

function HeroSkeleton() {
  return (
    <header className={HERO_CLASS} aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-4 w-28 rounded-full bg-white/20" />
          <div className="h-7 w-44 rounded-full bg-white/25" />
        </div>
        <div className="size-14 shrink-0 rounded-full bg-white/20" />
      </div>
      <HeroChipsPlaceholder />
    </header>
  );
}

/**
 * Home placeholder that mirrors the real layout: hero, "next up" card, class
 * carousel and the 2×2 quick menu. Used by loading.tsx and by the page while
 * LIFF starts / the summary loads (pass the real `hero` once the profile is known).
 * Server-compatible.
 */
export function DashboardSkeleton({ hero }: { hero?: ReactNode }) {
  return (
    <Screen>
      {hero ?? <HeroSkeleton />}
      <LoadingAnnouncement />
      <div className="flex flex-col gap-6 px-4 pt-4 pb-6" aria-hidden="true">
        <div className={`${cardClass} p-4`}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="h-4 w-2/3 rounded-full" />
            </div>
          </div>
          <Skeleton className="mt-4 h-[84px] w-full rounded-2xl" />
          <Skeleton className="mt-4 h-[52px] w-full rounded-2xl" />
        </div>

        <section>
          <div className="flex min-h-11 items-center">
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 py-1">
            <Skeleton className="h-[116px] w-[78%] max-w-[300px] shrink-0 rounded-[var(--radius-card)]" />
            <Skeleton className="h-[116px] w-[140px] shrink-0 rounded-[var(--radius-card)]" />
          </div>
        </section>

        <section>
          <div className="flex min-h-11 items-center">
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className={`${cardClass} flex min-h-[112px] flex-col gap-3 p-4`}>
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="h-4 w-3/4 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </Screen>
  );
}
