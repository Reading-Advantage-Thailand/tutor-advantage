import { AppBar, CardSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { HeroOverlap, ToneHero } from "@/components/mobile/Hero";
import { t } from "@/lib/i18n";

/** Result detail placeholder in the final layout (loading.tsx + the page's loading branch): hero, result card, answer cards. */
export function DetailSkeleton() {
  return (
    <Screen>
      <AppBar title={t("lessonHistory.summaryTitle")} back fallbackHref="/lesson/history" variant="brand" />
      <LoadingAnnouncement />
      <ToneHero as="div">
        <div aria-hidden="true">
          <Skeleton className="h-6 w-4/5 rounded-full" />
          <Skeleton className="mt-3 h-3.5 w-1/2 rounded-full" />
        </div>
      </ToneHero>
      <HeroOverlap className="pb-8">
        <div aria-hidden="true" className="contents">
          <div className="grid grid-cols-2 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]">
            {[0, 1].map((index) => (
              <div key={index} className={`flex flex-col gap-2.5 p-4 ${index ? "border-l-[1.5px] border-hairline" : ""}`}>
                <Skeleton className="h-3.5 w-16 rounded-full" />
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-10 rounded-full" />
                  <Skeleton className="h-7 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex min-h-11 items-center">
            <Skeleton className="h-5 w-40 rounded-full" />
          </div>
          <CardSkeleton media={false} lines={3} />
          <CardSkeleton media={false} lines={3} />
        </div>
      </HeroOverlap>
    </Screen>
  );
}
