import { BookOpen, Flame } from "lucide-react";
import { Chip, UserAvatar } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { getGreetingKey } from "./dashboardModel";

/**
 * Light-mint hero shell shared with the skeleton; dark-green text keeps ≥ 7:1
 * (tokens flip to a deep green with light text in dark mode).
 */
export const HERO_CLASS =
  "rounded-b-[28px] bg-hero px-4 pt-[calc(var(--safe-top)+20px)] pb-6 text-hero-fg";

export interface DashboardHeroProps {
  name: string;
  pictureUrl?: string | null;
  /** Book/CEFR of the featured class; hidden when null. */
  levelLabel: string | null;
  weekStreak: number;
  /** Summary still loading: reserve the chip row so nothing jumps when it arrives. */
  chipsLoading?: boolean;
}

/** Placeholder pills for the level/streak row (shared with the skeleton). */
export function HeroChipsPlaceholder() {
  return (
    <div className="mt-4 flex gap-2" aria-hidden="true">
      <div className="h-[30px] w-40 rounded-full bg-hero-chip" />
      <div className="h-[30px] w-28 rounded-full bg-hero-chip" />
    </div>
  );
}

/**
 * Home greeting: time-of-day hello, the student's LINE name and picture, level
 * and streak chips. Rendered only on the client (the greeting uses the device
 * clock, so it never goes through SSR).
 */
export function DashboardHero({ name, pictureUrl, levelLabel, weekStreak, chipsLoading = false }: DashboardHeroProps) {
  const greeting = t(getGreetingKey(new Date().getHours()));
  const showChips = Boolean(levelLabel) || weekStreak > 0;

  return (
    <header className={HERO_CLASS}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-[1.5] font-medium text-hero-fg-muted">{greeting}</p>
          <h1 className="truncate text-2xl leading-[1.35] font-extrabold">{name}</h1>
        </div>
        <UserAvatar src={pictureUrl} name={name} size="lg" ring="onBrand" decorative />
      </div>
      {chipsLoading ? (
        <HeroChipsPlaceholder />
      ) : showChips ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {levelLabel ? (
            <Chip tone="onBrand" size="md" icon={BookOpen}>
              {levelLabel}
            </Chip>
          ) : null}
          {weekStreak > 0 ? (
            <Chip tone="onBrand" size="md" icon={Flame}>
              {weekStreak} {t("dashboard.weekStreakSuffix")}
            </Chip>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
