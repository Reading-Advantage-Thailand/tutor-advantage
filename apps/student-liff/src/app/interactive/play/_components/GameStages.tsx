"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Check, Eye, Gamepad2, Gift, Search } from "lucide-react";
import { Chip, IconTile } from "@/components/mobile";
import { lessonCardClass, PhaseColumn } from "@/components/lesson/PhaseBlocks";
import { ReedyMini } from "@/components/mascot/ReedyMini";
import type { LiveLessonGame } from "@/lib/liveLessonGames";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
 * Presentational stages around a lesson game (S6 "Games"): vote, ready,
 * teacher demo, tutorial and countdown. They sit on the lesson's paper theme
 * (no forced-dark stage); the game itself keeps its own art once it plays.
 * No data or handlers live here: the play page passes them in unchanged.
 */

/** Full-screen paper stage for the moments the game covers the lesson bar. */
function FullStage({ children, center = true }: { children: ReactNode; center?: boolean }) {
  return (
    <div
      className={cn(
        "phase-enter fixed inset-0 z-50 h-dvh w-screen overflow-y-auto overscroll-contain bg-app px-4",
        center && "flex flex-col",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-sm flex-col gap-4 pt-[calc(24px+var(--safe-top))] pb-[calc(24px+var(--safe-bottom))]",
          center && "my-auto",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function CoverImage({ src, sizes, className }: { src: string; sizes: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-surface-muted", className)}>
      <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
    </div>
  );
}

/** Vote: one tappable card per playable game (cover, title, description), mine marked by a jade border + chip. */
export function GameVoteStage({ categoryLabel, games, hasMore, myVote, myVoteTitle, onVote }: {
  categoryLabel: string;
  games: LiveLessonGame[];
  hasMore: boolean;
  myVote?: string;
  /** "Dragon Flight", or "ยังไม่ได้เลือกเกม". */
  myVoteTitle: string;
  onVote: (gameId: string) => void;
}) {
  return (
    <PhaseColumn>
      {/* No "เกมคำศัพท์" eyebrow: the phase row above already names the game phase. */}
      <h2 className="px-1 font-heading text-[22px] leading-[1.35] font-bold text-fg">{t("interactivePlay.gameVoteTitle")}</h2>
      <ul aria-label={t("interactivePlay.gameVoteTitle")} className="flex list-none flex-col gap-3">
        {games.map((game) => {
          const isMine = myVote === game.id;
          return (
            <li key={game.id}>
              <button
                type="button"
                onClick={() => onVote(game.id)}
                aria-pressed={isMine}
                className={cn(
                  "clay-press flex w-full items-stretch gap-3.5 rounded-[var(--radius-card)] border-2 p-2.5 pr-3.5 text-left",
                  isMine
                    ? "border-brand-fg bg-brand-soft shadow-[0_var(--ledge)_0_var(--brand-soft-border)]"
                    : "border-clay-rim bg-surface shadow-[var(--shadow-tap)]",
                )}
              >
                <CoverImage src={game.cover} sizes="112px" className="w-[104px] shrink-0 self-stretch rounded-[18px] [@media(min-width:400px)]:w-28" />
                <span className="flex min-w-0 flex-1 flex-col gap-1 py-1">
                  {/* Chips sit beside the cover, never over its art. */}
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="neutral" size="sm">{categoryLabel}</Chip>
                    {isMine ? (
                      <Chip tone="brand" size="sm" icon={Check} className="bg-surface">
                        {t("interactivePlay.selected")}
                      </Chip>
                    ) : null}
                  </span>
                  <span lang="en" className="font-heading text-lg leading-[1.35] font-bold text-fg">{game.title}</span>
                  <span className="line-clamp-2 text-sm leading-[1.6] text-fg-muted">{game.description}</span>
                  <span
                    className={cn(
                      "mt-auto inline-flex h-11 items-center justify-center rounded-[14px] px-4 font-heading text-[15px] leading-[1.3] font-semibold",
                      isMine ? "bg-brand-solid text-on-brand" : "bg-brand-soft text-brand-soft-fg",
                    )}
                  >
                    {isMine ? t("interactivePlay.voteDone") : t("interactivePlay.chooseThisGame")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {hasMore ? (
          <li className="flex items-center gap-3.5 rounded-[var(--radius-card)] bg-surface-muted px-4 py-3.5">
            <IconTile icon={Gift} tone="amber" size="md" />
            <div className="min-w-0">
              <p className="font-heading text-base leading-[1.45] font-semibold text-fg">{t("interactivePlay.moreGamesSoonTitle")}</p>
              <p className="text-[13px] leading-[1.6] text-fg-muted">{t("interactivePlay.moreGamesSoonDescription")}</p>
            </div>
          </li>
        ) : null}
      </ul>
      <div role="status" className={cn(lessonCardClass, "flex items-center gap-3 px-4 py-3")}>
        <IconTile icon={Gamepad2} tone={myVote ? "brand" : "neutral"} size="sm" />
        <div className="min-w-0">
          <p className="text-[13px] leading-[1.5] text-fg-muted">{t("interactivePlay.yourVote")}</p>
          <p className="truncate text-base leading-[1.5] font-semibold text-fg">{myVoteTitle}</p>
        </div>
      </div>
    </PhaseColumn>
  );
}

/** The class chose a game; the tutor is getting it ready. */
export function GameReadyStage({ selected }: { selected?: LiveLessonGame }) {
  return (
    <PhaseColumn>
      <section className={cn(lessonCardClass, "overflow-hidden")}>
        {selected?.cover ? <CoverImage src={selected.cover} sizes="560px" className="h-44 w-full border-b-[1.5px] border-clay-rim" /> : null}
        {selected ? (
          <div className="px-[18px] pt-3.5">
            <Chip tone="brand" size="md" icon={Check}>{t("interactivePlay.gameReadyEyebrow")}</Chip>
            <h2 lang="en" className="mt-2 font-heading text-[24px] leading-[1.3] font-bold text-fg">{selected.title}</h2>
          </div>
        ) : null}
        <div className="flex items-center gap-3.5 px-[18px] py-4">
          <IconTile icon={Gamepad2} tone="brand" size="md" />
          <div className="min-w-0">
            <h3 className="font-heading text-[17px] leading-[1.4] font-semibold text-fg">{t("interactivePlay.gameReadyTitle")}</h3>
            <p className="mt-0.5 text-sm leading-[1.6] text-fg-muted">{t("interactivePlay.gameReadyDescription")}</p>
          </div>
        </div>
      </section>
    </PhaseColumn>
  );
}

/** The tutor plays first while the class watches the big screen. */
export function TeacherDemoStage({ selected }: { selected?: LiveLessonGame }) {
  return (
    <FullStage>
      {selected?.cover ? <CoverImage src={selected.cover} sizes="384px" className="h-40 w-full rounded-[var(--radius-card)] border-[1.5px] border-clay-rim" /> : null}
      <div className="flex flex-col items-center text-center">
        <ReedyMini mood="calm" size="md" decorative badge={<Eye strokeWidth={2.4} />} badgeClassName="bg-tile-blue text-icon-blue" />
        <Chip tone="info" size="md" className="mt-3">{t("interactivePlay.teacherDemoEyebrow")}</Chip>
        <h2 className="mt-2 font-heading text-[28px] leading-[1.3] font-bold text-fg">{t("interactivePlay.teacherDemoTitle")}</h2>
        <p className="mt-1.5 text-base leading-[1.65] text-fg-muted">
          {t("interactivePlay.teacherDemoDescription")} <span lang={selected?.title ? "en" : undefined} className="font-semibold text-fg">{selected?.title || t("interactivePlay.thisGame")}</span>
        </p>
      </div>
      <div className={cn(lessonCardClass, "px-[18px] py-4")}>
        <p className="font-heading text-base leading-[1.45] font-semibold text-fg">{t("interactivePlay.teacherDemoWatchTitle")}</p>
        {/* The "·"-separated list as one row per item, so a Thai line never breaks inside a phrase. */}
        <ul className="mt-2 flex list-none flex-col gap-1.5">
          {t("interactivePlay.teacherDemoWatchList").split(" · ").map((item) => (
            <li key={item} className="flex items-start gap-2 text-[15px] leading-[1.6] text-fg">
              <Search aria-hidden="true" className="mt-1 size-4 shrink-0 text-info-fg" strokeWidth={2.4} />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </FullStage>
  );
}

/** How to play: three numbered steps, then a waiting line until the tutor starts. */
export function GameTutorialStage({ selectedTitle, steps }: { selectedTitle: string; steps: string[] }) {
  return (
    <div className="phase-enter fixed inset-0 z-50 h-dvh w-screen overflow-y-auto overscroll-contain bg-app px-4">
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center pt-[calc(20px+var(--safe-top))] pb-[calc(24px+var(--safe-bottom))] [@media(max-height:480px)]:max-w-3xl [@media(max-height:480px)]:pb-[var(--safe-bottom)]">
        <h2 className="font-heading text-[26px] leading-[1.3] font-bold text-fg [@media(max-height:480px)]:text-[20px]">
          {t("interactivePlay.tutorialEyebrow")} <span lang="en">{selectedTitle}</span>
        </h2>
        <p className="mt-1.5 text-[15px] leading-[1.6] text-fg-muted [@media(max-height:480px)]:mt-0.5">{t("interactivePlay.tutorialHint")}</p>
        <ol className="mt-6 grid gap-3 [@media(max-height:480px)]:mt-3 [@media(max-height:480px)]:grid-cols-3 [@media(max-height:480px)]:gap-2">
          {steps.map((step, index) => (
            <li key={step} className={cn(lessonCardClass, "flex gap-3.5 p-4 [@media(max-height:480px)]:flex-col [@media(max-height:480px)]:gap-1.5 [@media(max-height:480px)]:p-3")}>
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft font-heading text-lg leading-none font-bold text-brand-soft-fg [@media(max-height:480px)]:size-8 [@media(max-height:480px)]:text-base">
                {index + 1}
              </span>
              <p className="self-center text-[15px] leading-[1.6] font-semibold text-fg [@media(max-height:480px)]:self-start [@media(max-height:480px)]:text-[13px]">{step}</p>
            </li>
          ))}
        </ol>
        <p role="status" className="mt-6 flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-warning-border bg-warning-bg px-4 py-3 text-[15px] leading-[1.5] font-semibold text-warning-fg [@media(max-height:480px)]:mt-3 [@media(max-height:480px)]:py-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-current" />
          {t("interactivePlay.tutorialWaiting")}
        </p>
      </div>
    </div>
  );
}

/** Seconds until the game starts (reading face, tabular: the number ticks). */
export function GameCountdownStage({ countdownLeft, selectedTitle }: { countdownLeft: number; selectedTitle: string }) {
  return (
    <div className="phase-enter fixed inset-0 z-50 flex h-dvh w-screen items-center justify-center overflow-hidden bg-app p-6 text-center">
      <div className="flex w-full max-w-sm flex-col items-center">
        <Chip tone="brand" size="md" icon={Gamepad2}>{t("interactivePlay.getReady")}</Chip>
        {/* The seconds left are read out politely as they change. A live region
            mounted with its text already in it is often not announced, so the
            changing number carries the announcement. */}
        <p
          role="timer"
          aria-live="polite"
          aria-atomic="true"
          className="mt-7 flex size-[clamp(11rem,58vw,15rem)] items-center justify-center rounded-full border-[1.5px] border-clay-rim bg-surface text-[clamp(5.5rem,30vw,8.5rem)] leading-none font-semibold text-brand-fg tabular-nums shadow-[var(--shadow-card)]"
        >
          {countdownLeft}
        </p>
        <p lang="en" className="mt-7 font-heading text-2xl leading-[1.3] font-bold text-fg">
          {selectedTitle}
        </p>
        <p className="mt-1.5 text-sm leading-[1.6] text-fg-muted">{t("interactivePlay.gameStartsAutomatically")}</p>
      </div>
    </div>
  );
}
