"use client";

/**
 * Phase 17 pair conversation and phase 18 final ranking (components.md §7
 * WrapUpStages): paper stage, pairs as cards, the podium per §6.5 with Reedy
 * cheer beside the headline (one Reedy per stage), then ranks 4+.
 */
import { Lightbulb, MessagesSquare, Trophy, Users } from "lucide-react";
import { UserAvatar } from "@/components/app";
import { ReedyMini } from "@/components/mascot/ReedyMini";
import type { LessonPair, Participant } from "@/lib/lesson-types";
import { t } from "@/lib/i18n";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { PodiumStage, StageEyebrow, StageHeading, StagePanel, type PodiumEntry } from "./primitives";
import { rankByScore } from "./scoreRanking";

const CONVERSATION_STARTERS = [
  "What was this story about?",
  "Which new word do you like? Why?",
  "What is the most interesting part?",
  "What did you learn today?",
];

export function PairConversationStage({
  pairs,
  showEmptyState,
  preparationMode = false,
}: {
  pairs: LessonPair[];
  showEmptyState: boolean;
  preparationMode?: boolean;
}) {
  const hasTriple = pairs.some((pair) => pair.members.length > 2);
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 xl:gap-5">
      <StageHeading
        icon={MessagesSquare}
        tone="orange"
        eyebrow={t("lesson.interactive.pairTitle")}
        title={t("lesson.interactive.pairSubtitle")}
      />
      {hasTriple ? (
        <p className="inline-flex items-center gap-2 self-start rounded-full bg-warning-bg px-3 py-1.5 text-sm font-semibold text-warning-fg">
          <Users aria-hidden="true" className="size-4 shrink-0" />
          {t("lesson.interactive.pairTripleNote")}
        </p>
      ) : null}

      {showEmptyState ? (
        <StagePanel as="div" className="flex flex-col items-center gap-3 px-8 py-10 text-center">
          <span aria-hidden="true" className="inline-flex size-14 items-center justify-center rounded-2xl bg-tile-neutral text-icon-neutral">
            <Users className="size-7" />
          </span>
          <p className="text-lg font-medium text-fg-muted">{t("lesson.interactive.pairNeedTwo")}</p>
        </StagePanel>
      ) : (
        <ol data-tour-target={preparationMode ? "phase-17-pairs" : undefined} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pairs.map((pair) => (
            <li key={pair.pairNumber} className="min-w-0">
              <StagePanel as="div" className="flex h-full flex-col gap-3 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-fg xl:text-base">
                  <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-brand-soft text-brand-soft-fg">
                    <Users className="size-4" />
                  </span>
                  {t("lesson.interactive.pairGroupLabel")} {pair.pairNumber}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {pair.members.map((member) => (
                    <li key={member.studentId} className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={member.name} src={member.pictureUrl} toneKey={member.studentId} size="md" />
                      <span className="truncate text-lg font-semibold text-fg xl:text-xl" title={member.name}>
                        {member.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </StagePanel>
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <StagePanel data-tour-target={preparationMode ? "phase-17-starters" : undefined} className="p-4 xl:p-5">
          <StageEyebrow icon={MessagesSquare}>{t("lesson.interactive.pairStartersTitle")}</StageEyebrow>
          <ul className="mt-3 flex flex-col gap-2">
            {CONVERSATION_STARTERS.map((starter, index) => (
              <li key={starter} lang="en" className="flex items-start gap-3 rounded-(--radius-ctl) bg-surface-muted px-3 py-2.5 text-lg font-medium text-fg xl:text-xl">
                <span aria-hidden="true" className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold text-fg-muted tabular-nums shadow-[inset_0_0_0_1px_var(--clay-rim)]">
                  {index + 1}
                </span>
                {starter}
              </li>
            ))}
          </ul>
        </StagePanel>
        <StagePanel data-tour-target={preparationMode ? "phase-17-tutor-actions" : undefined} className="p-4 xl:p-5">
          <StageEyebrow icon={Lightbulb}>{t("lesson.live.tutorActions")}</StageEyebrow>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-base leading-[1.6] text-fg-muted marker:text-fg-subtle xl:text-lg xl:leading-[1.6]">
            <li>{thaiCopy(t("lesson.interactive.pairTutorTip1"))}</li>
            <li>{thaiCopy(t("lesson.interactive.pairTutorTip2"))}</li>
            <li>{thaiCopy(t("lesson.interactive.pairTutorTip3"))}</li>
          </ul>
        </StagePanel>
      </div>
    </div>
  );
}

export function FinalLeaderboardStage({
  participants,
  preparationMode = false,
}: {
  participants: Participant[];
  preparationMode?: boolean;
}) {
  // Same competition ranking as the students' phones: 14, 7, 7 → 1, 2, 2.
  const ranked = rankByScore(participants);
  const podium: PodiumEntry[] = ranked.slice(0, 3).map(({ item: p, score, rank }, index) => ({
    key: p.studentId || `place-${index + 1}`,
    name: p.name,
    pictureUrl: p.pictureUrl,
    score,
    place: (index + 1) as 1 | 2 | 3,
    rank,
  }));

  return (
    <div data-tour-target={preparationMode ? "phase-18-summary" : undefined} className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 xl:gap-6">
      <div className="flex items-center justify-center gap-4 text-center sm:gap-6">
        <ReedyMini mood="cheer" size={96} decorative className="max-sm:hidden" />
        <div className="min-w-0">
          <StageEyebrow icon={Trophy}>{t("lesson.interactive.leaderboardTitle")}</StageEyebrow>
          <h2 className="mt-1 font-heading text-2xl leading-[1.35] font-semibold text-balance-th text-fg xl:text-[2rem]">
            {thaiLabel(t("lesson.interactive.leaderboardSubtitle"))}
          </h2>
        </div>
      </div>

      {podium.length > 0 ? (
        <StagePanel as="div" className="px-4 pt-6 sm:px-8">
          <PodiumStage entries={podium} scoreUnit={t("lesson.interactive.scoreUnit")} className="mx-auto w-full max-w-3xl" />
        </StagePanel>
      ) : null}

      {ranked.length > 3 ? (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.slice(3).map(({ item: p, score, rank }, i) => (
            <li
              key={p.studentId || i}
              className="flex min-h-14 items-center gap-3 rounded-(--radius-ctl) border border-clay-rim bg-surface px-3 py-2"
            >
              <span className="w-7 shrink-0 text-center text-base font-semibold text-fg-muted tabular-nums">{rank}</span>
              <UserAvatar name={p.name} src={p.pictureUrl} toneKey={p.studentId} size="nav" />
              <span className="min-w-0 flex-1 truncate text-base font-medium text-fg xl:text-lg" title={p.name}>
                {p.name}
              </span>
              <span className={cn("shrink-0 text-lg font-semibold text-fg tabular-nums")}>{score}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
