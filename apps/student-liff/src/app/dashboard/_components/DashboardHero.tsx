import { BookOpen, Flame } from "lucide-react";
import { Chip, UserAvatar } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { getGreetingKey } from "./dashboardModel";

/**
 * Brand hero shell shared with the skeleton. brand-700 → brand-800 keeps white
 * text ≥ 5:1 everywhere (the lighter LINE green is only ~3:1).
 */
export const HERO_CLASS =
  "rounded-b-[28px] bg-[image:linear-gradient(160deg,var(--brand-700)_0%,var(--brand-800)_100%)] px-4 pt-[calc(var(--safe-top)+20px)] pb-6 text-white";

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
      <div className="h-[30px] w-40 rounded-full bg-white/15" />
      <div className="h-[30px] w-28 rounded-full bg-white/15" />
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
          <p className="text-sm leading-[1.5] font-medium text-white/90">{greeting}</p>
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
