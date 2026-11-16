import { AppBar, BottomActionBar, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { HeroOverlap, ToneHero } from "@/components/mobile/Hero";
import { t } from "@/lib/i18n";

/**
 * Lobby placeholder in the final layout (used by loading.tsx and the page's
 * loading branch): band hero, the activity card over it, the status line, the
 * classmates card and the ready bar. Neutral colour until the class loads.
 */
export function LobbySkeleton({ fallbackHref = "/dashboard" }: { fallbackHref?: string }) {
  return (
    <Screen>
      <AppBar title={t("lessonLobby.lobbyTitle")} back fallbackHref={fallbackHref} tone="neutral" />
      <LoadingAnnouncement label={t("lessonLobby.preparingTitle")} />
      <ToneHero tone="neutral" as="div">
        <div aria-hidden="true">
          <Skeleton className="h-8 w-28 rounded-full bg-hero-chip" />
          <Skeleton className="mt-4 h-6 w-2/3 rounded-full bg-hero-chip" />
          <div className="mt-3.5 flex items-center gap-2">
            <Skeleton className="size-8 rounded-full bg-hero-chip" />
            <Skeleton className="h-4 w-32 rounded-full bg-hero-chip" />
          </div>
        </div>
      </ToneHero>
      <HeroOverlap>
        <div aria-hidden="true" className="contents">
          <div className="flex items-center gap-3.5 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 shadow-[var(--shadow-card)]">
            <Skeleton className="size-14 shrink-0 rounded-[18px]" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-1/3 rounded-full" />
              <Skeleton className="h-4 w-1/2 rounded-full" />
              <Skeleton className="h-3 w-4/5 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-[60px] w-full rounded-[var(--radius-card)]" />
          <div className="flex flex-col gap-1">
            <div className="flex min-h-11 items-center justify-between">
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-4 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 shadow-[var(--shadow-card)] sm:grid-cols-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <Skeleton className="size-14 rounded-full" />
                  <Skeleton className="h-3 w-12 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </HeroOverlap>
      <BottomActionBar>
        <Skeleton className="h-14 w-full rounded-[20px]" />
      </BottomActionBar>
    </Screen>
  );
}
