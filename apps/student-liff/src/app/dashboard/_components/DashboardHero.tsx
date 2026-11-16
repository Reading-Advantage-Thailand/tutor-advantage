import type { ReactNode } from "react";
import { Flame, Moon, Sun } from "lucide-react";
import { Chip, UserAvatar } from "@/components/mobile";
import { ReedyMini } from "@/components/mascot/ReedyMini";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getGreetingKey, type ReedyLine } from "./dashboardModel";

/**
 * Home hero shell (components.md §3.3), shared with the skeleton: the flat
 * hero colour with two decorative blobs (`hero-surface`), rounded bottom 32.
 * The next card overlaps its bottom by 30px, so without Reedy it keeps room
 * for that overlap.
 */
export const HERO_CLASS = "hero-surface px-4 pt-[calc(var(--safe-top)+18px)]";
/** Bottom room when the hero ends without Reedy's row (30px overlap + 18px). */
export const HERO_NO_REEDY_CLASS = "pb-12";

export interface DashboardHeroProps {
  name: string;
  pictureUrl?: string | null;
  /** Book/CEFR of the featured class; hidden when null. */
  levelLabel: string | null;
  weekStreak: number;
  /** Summary still loading: reserve the chip row so nothing jumps when it arrives. */
  chipsLoading?: boolean;
  /**
   * Reedy's row: what he says (from the data), "loading" to reserve his row
   * while the summary loads, or null for no Reedy (error and empty states carry
   * their own Reedy: one per screen).
   */
  reedy?: ReedyLine | "loading" | null;
}

/** Placeholder pills for the level/streak row (shared with the skeleton). */
export function HeroChipsPlaceholder() {
  return (
    <div className="flex gap-2" aria-hidden="true">
      <div className="h-8 w-44 rounded-full border-[1.5px] border-hero-ring bg-hero-chip" />
      <div className="h-8 w-28 rounded-full border-[1.5px] border-hero-ring bg-hero-chip" />
    </div>
  );
}

/** Reedy's row placeholder: a bubble-shaped pill and his spot, so nothing jumps when he arrives. */
export function HeroReedyPlaceholder() {
  return (
    <div className="mt-1.5 flex items-start justify-between gap-2" aria-hidden="true">
      <div className="mt-[18px] h-[46px] w-[200px] rounded-[18px_18px_6px_18px] border-[1.5px] border-hero-ring bg-hero-chip" />
      <div className="-mr-2 size-[124px] shrink-0" />
    </div>
  );
}

/**
 * Authored Thai breaks (patterns.md "Thai text"): each space-separated phrase
 * of fixed copy stays on one line, so the bubble breaks only between phrases
 * ("ยังไม่มีคาบถัดไป / ลองฝึกพูดกับรีดี้ไหม", never "ลอง / ฝึกพูด").
 */
function Phrases({ text }: { text: string }) {
  const phrases = text.split(" ").filter(Boolean);
  return (
    <>
      {phrases.map((phrase, index) => (
        <span key={index}>
          {index > 0 ? " " : null}
          <span className="whitespace-nowrap">{phrase}</span>
        </span>
      ))}
    </>
  );
}

/** Reedy's sentence; the class name may wrap anywhere (it can be long), the fixed copy keeps its phrases. */
function ReedySpeech({ line }: { line: ReedyLine }): ReactNode {
  if (line.kind === "live") return <Phrases text={t("dashboard.liveNow")} />;
  if (line.kind === "noNext") return <Phrases text={t("dashboard.reedyNoNextLesson")} />;
  return (
    <>
      <Phrases text={t("dashboard.reedyContinuePrefix")} /> {line.className}{" "}
      <Phrases text={t("dashboard.reedyContinueSuffix")} />
    </>
  );
}

/**
 * Home hero (patterns.md S1): time-of-day greeting, the student's name as the
 * page h1, avatar 52, the level chip (paper) and the streak chip (the view's
 * one sunshine reward, only when weekStreak > 0), then Reedy (happy 124) with
 * a speech bubble built from the data; his body tucks behind the next card.
 * Rendered only on the client (the greeting uses the device clock).
 */
export function DashboardHero({
  name,
  pictureUrl,
  levelLabel,
  weekStreak,
  chipsLoading = false,
  reedy = null,
}: DashboardHeroProps) {
  const greetingKey = getGreetingKey(new Date().getHours());
  const GreetingIcon = greetingKey === "dashboard.evening" ? Moon : Sun;
  const showChips = Boolean(levelLabel) || weekStreak > 0;

  return (
    <header className={cn(HERO_CLASS, !reedy && HERO_NO_REEDY_CLASS)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] leading-[1.6] font-medium text-hero-fg-muted">
            <GreetingIcon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />
            {t(greetingKey)}
          </p>
          <h1 className="t-display mb-2.5 text-balance break-words">{name}</h1>
        </div>
        <UserAvatar src={pictureUrl} name={name} size="hero" ring="surface" decorative className="mt-1" />
      </div>

      {chipsLoading ? (
        <HeroChipsPlaceholder />
      ) : showChips ? (
        <div className="flex flex-wrap gap-2">
          {levelLabel ? (
            <Chip tone="paper" size="md">
              {levelLabel}
            </Chip>
          ) : null}
          {weekStreak > 0 ? (
            <Chip tone="sun" size="md" icon={Flame}>
              {weekStreak} {t("dashboard.weekStreakSuffix")}
            </Chip>
          ) : null}
        </div>
      ) : null}

      {reedy === "loading" ? (
        <HeroReedyPlaceholder />
      ) : reedy ? (
        <div className="mt-1.5 flex items-start justify-between gap-2">
          {/* mb = the 30px the next-up card overlaps the hero + a 10px gap, so a long bubble stays visible and never touches the card */}
          <p className="bubble mt-[18px] mb-[40px] max-w-[232px] text-balance">
            <ReedySpeech line={reedy} />
          </p>
          <ReedyMini mood="happy" size="hero" float decorative className="-mr-2" />
        </div>
      ) : null}
    </header>
  );
}
