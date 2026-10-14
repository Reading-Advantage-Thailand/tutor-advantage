"use client";

/** Phase 17 pair conversation and phase 18 final ranking. */
import { Lightbulb, MessagesSquare, Trophy, Users } from "lucide-react";
import { UserAvatar } from "@/components/app";
import type { LessonPair, Participant } from "@/lib/lesson-types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { StageEyebrow, StagePanel } from "./primitives";

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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
      <div className="text-center">
        <StageEyebrow icon={MessagesSquare}>{t("lesson.interactive.pairTitle")}</StageEyebrow>
        <p className="mt-1 text-xl font-semibold text-fg xl:text-2xl">{t("lesson.interactive.pairSubtitle")}</p>
        {hasTriple ? <p className="mt-1 text-sm font-semibold text-warning-fg">{t("lesson.interactive.pairTripleNote")}</p> : null}
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline-strong bg-surface px-8 py-8 text-center">
          <Users aria-hidden="true" className="size-8 text-fg-subtle" />
          <p className="text-base font-medium text-fg-muted">{t("lesson.interactive.pairNeedTwo")}</p>
        </div>
      ) : (
        <div data-tour-target={preparationMode ? "phase-17-pairs" : undefined} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pairs.map((pair) => (
            <StagePanel as="div" key={pair.pairNumber} className="flex flex-col gap-3 p-4">
              <p className="text-sm font-semibold text-brand-fg">
                {t("lesson.interactive.pairGroupLabel")} {pair.pairNumber}
              </p>
              <ul className="flex flex-col gap-2">
                {pair.members.map((member) => (
                  <li key={member.studentId} className="flex min-w-0 items-center gap-3">
                    <UserAvatar name={member.name} src={member.pictureUrl} size="md" />
                    <span className="truncate text-lg font-semibold text-fg">{member.name}</span>
                  </li>
                ))}
              </ul>
            </StagePanel>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <StagePanel data-tour-target={preparationMode ? "phase-17-starters" : undefined} className="p-4">
          <StageEyebrow icon={MessagesSquare}>{t("lesson.interactive.pairStartersTitle")}</StageEyebrow>
          <ul className="mt-3 flex flex-col gap-2">
            {CONVERSATION_STARTERS.map((starter) => (
              <li key={starter} className="rounded-lg bg-surface-muted px-3 py-2 text-lg font-medium text-fg">
                {starter}
              </li>
            ))}
          </ul>
        </StagePanel>
        <StagePanel data-tour-target={preparationMode ? "phase-17-tutor-actions" : undefined} className="p-4">
          <StageEyebrow icon={Lightbulb}>{t("lesson.live.tutorActions")}</StageEyebrow>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-base text-fg-muted marker:text-fg-subtle">
            <li>{t("lesson.interactive.pairTutorTip1")}</li>
            <li>{t("lesson.interactive.pairTutorTip2")}</li>
            <li>{t("lesson.interactive.pairTutorTip3")}</li>
          </ul>
        </StagePanel>
      </div>
    </div>
  );
}

const PODIUM = [
  { rank: 2, order: "order-1", height: "h-20", avatar: "lg" as const, tone: "bg-surface-muted text-fg-muted" },
  { rank: 1, order: "order-2", height: "h-28", avatar: "lg" as const, tone: "bg-brand-solid text-on-brand" },
  { rank: 3, order: "order-3", height: "h-14", avatar: "lg" as const, tone: "bg-surface-muted text-fg-muted" },
];

export function FinalLeaderboardStage({
  participants,
  preparationMode = false,
}: {
  participants: Participant[];
  preparationMode?: boolean;
}) {
  const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div data-tour-target={preparationMode ? "phase-18-summary" : undefined} className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5">
      <div className="text-center">
        <StageEyebrow icon={Trophy}>{t("lesson.interactive.leaderboardTitle")}</StageEyebrow>
        <p className="mt-1 text-xl font-semibold text-fg xl:text-2xl">{t("lesson.interactive.leaderboardSubtitle")}</p>
      </div>

      <div className="mx-auto grid w-full max-w-3xl grid-cols-3 items-end gap-4">
        {PODIUM.map((slot) => {
          const p = sorted[slot.rank - 1];
          if (!p) return <div key={slot.rank} className={slot.order} />;
          return (
            <div key={slot.rank} className={cn("flex min-w-0 flex-col items-center gap-2", slot.order)}>
              <UserAvatar name={p.name} src={p.pictureUrl} size={slot.avatar} className={slot.rank === 1 ? "ring-4 ring-brand-soft-border" : undefined} />
              <p className="max-w-full truncate px-1 text-center text-lg font-semibold text-fg">{p.name}</p>
              <p className={cn("font-bold tabular-nums", slot.rank === 1 ? "text-4xl text-brand-fg" : "text-2xl text-fg")}>
                {p.score || 0}
                <span className="ml-1 text-sm font-medium text-fg-muted">{t("lesson.interactive.scoreUnit")}</span>
              </p>
              <div className={cn("flex w-full items-start justify-center rounded-t-xl pt-2 text-3xl font-bold", slot.height, slot.tone)}>
                {slot.rank}
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length > 3 ? (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.slice(3).map((p, i) => (
            <li key={p.studentId || i} className="flex items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-2">
              <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums text-fg-subtle">{i + 4}</span>
              <UserAvatar name={p.name} src={p.pictureUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate text-base font-medium text-fg">{p.name}</span>
              <span className="shrink-0 text-base font-bold tabular-nums text-fg">{p.score || 0}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
