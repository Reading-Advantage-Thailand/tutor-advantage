import { Share2 } from "lucide-react";
import {
  AppBar,
  BottomActionBar,
  IconButton,
  ListGroup,
  ListRowSkeleton,
  LoadingAnnouncement,
  Screen,
  Skeleton,
} from "@/components/mobile";
import type { CefrTone } from "@/lib/cefr";
import { t } from "@/lib/i18n";
import { HeroOverlap, ToneHero } from "@/components/mobile/Hero";

/**
 * The detail screen's app bar: back (to the catalog when there is no in-app
 * history) + share. Share is disabled until the class has loaded. With `tone`
 * the bar takes the class's band colour and continues into the hero.
 */
export function ClassDetailAppBar({ onShare, tone }: { onShare?: () => void; tone?: CefrTone }) {
  return (
    <AppBar
      title={t("classes.detail.title")}
      back
      fallbackHref="/classes"
      tone={tone}
      actions={
        <span id="btn-share-class" className="inline-flex">
          <IconButton icon={Share2} label={t("classes.detail.shareAria")} onClick={onShare} disabled={!onShare} />
        </span>
      }
    />
  );
}

/**
 * Loading state of /classes/[id] (route loading.tsx and the page's own
 * loading branch): app bar, the band hero, the first card that overlaps it,
 * a list and the bottom action bar — the blocks both the enrolled and the
 * sales layout start with. The colour is neutral until the class (and its
 * level) has loaded.
 */
export function ClassDetailSkeleton() {
  return (
    <Screen>
      <ClassDetailAppBar tone="neutral" />
      <LoadingAnnouncement />
      <ToneHero tone="neutral" as="div">
        <div className="flex gap-2" aria-hidden="true">
          <Skeleton className="h-8 w-24 rounded-full bg-hero-chip" />
          <Skeleton className="h-8 w-28 rounded-full bg-hero-chip" />
        </div>
        <Skeleton className="mt-4 h-6 w-3/4 rounded-full bg-hero-chip" />
        <div className="mt-3.5 flex items-center gap-2" aria-hidden="true">
          <Skeleton className="size-8 rounded-full bg-hero-chip" />
          <Skeleton className="h-4 w-32 rounded-full bg-hero-chip" />
        </div>
        <Skeleton className="mt-3 h-3.5 w-1/2 rounded-full bg-hero-chip" />
      </ToneHero>
      <HeroOverlap>
        <div
          aria-hidden="true"
          className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-start gap-3.5">
            <Skeleton className="size-14 shrink-0 rounded-[18px]" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-3 w-1/3 rounded-full" />
              <Skeleton className="h-4 w-2/3 rounded-full" />
              <Skeleton className="h-3 w-1/2 rounded-full" />
            </div>
          </div>
          <Skeleton className="mt-4 h-11 w-full rounded-[var(--radius-ctl-sm)]" />
        </div>
        <div aria-hidden="true">
          <div className="flex min-h-11 items-center">
            <Skeleton className="h-5 w-1/3 rounded-full" />
          </div>
          <ListGroup>
            <ListRowSkeleton count={3} />
          </ListGroup>
        </div>
      </HeroOverlap>
      <BottomActionBar>
        <Skeleton className="h-14 flex-1 rounded-[20px]" />
      </BottomActionBar>
    </Screen>
  );
}
