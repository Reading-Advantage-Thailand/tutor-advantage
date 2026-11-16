"use client";

/**
 * Right-hand roster for the presenter (components.md §7 StudentRosterPanel):
 * a 320px panel with every student, whether they have answered the current
 * question / submitted the game, and their score. Status is a word plus an
 * icon (check · clock · wifi-off), never colour alone.
 *
 * While answers are coming in the students still thinking come first and
 * the ones who answered move to the end (score order inside each group), so
 * the tutor sees who to wait for. Between questions it is the class ranking
 * by score with rank numbers.
 */
import { Check, Clock3, UserMinus, Users, WifiOff } from "lucide-react";
import { Chip, Surface, UserAvatar } from "@/components/app";
import { Button } from "@/components/ui/button";
import type { Participant } from "@/lib/lesson-types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { rankByScore } from "./scoreRanking";

export interface StudentRosterPanelProps {
  participants: Participant[];
  /** Students who answered the current question (or submitted the game). */
  answeredStudentIds?: string[];
  /** Show the answered/waiting status per student (question & game phases). */
  showAnswerStatus?: boolean;
  preparationMode?: boolean;
  preparationFreeExplore?: boolean;
  /** Wording for the status line, e.g. votes or game submissions. Defaults to answers. */
  statusLabels?: { done: string; waiting: string; count: string };
  /** Shows a remove button per student (e.g. to stop waiting for a frozen phone). */
  onRemoveStudent?: (participant: Participant) => void;
  className?: string;
}

export function StudentRosterPanel({
  participants,
  answeredStudentIds = [],
  showAnswerStatus = true,
  preparationMode = false,
  preparationFreeExplore = false,
  statusLabels,
  onRemoveStudent,
  className,
}: StudentRosterPanelProps) {
  const labels = statusLabels ?? {
    done: t("lesson.live.statusAnswered"),
    waiting: t("lesson.live.statusThinking"),
    count: t("lesson.live.rosterAnswered"),
  };
  // Competition ranking like the podium and the students' phones: equal scores share a number.
  const ranked = rankByScore(participants);
  const rankOf = new Map(ranked.map(({ item, rank }) => [item, rank]));
  const byScore = ranked.map(({ item }) => item);
  const answeredIds = new Set(answeredStudentIds);
  const answeredCount = byScore.filter((p) => answeredIds.has(p.studentId)).length;
  const statusVisible = showAnswerStatus && !preparationFreeExplore;
  // Waiting first while answers come in (stable sort keeps the score order inside each group).
  const sorted = statusVisible
    ? [...byScore].sort((a, b) => Number(answeredIds.has(a.studentId)) - Number(answeredIds.has(b.studentId)))
    : byScore;
  const complete = statusVisible && byScore.length > 0 && answeredCount >= byScore.length;

  return (
    <Surface
      as="aside"
      padding="none"
      aria-label={t("lesson.live.rosterTitle")}
      className={cn("flex w-full shrink-0 flex-col overflow-hidden lg:w-80", className)}
    >
      <div className="flex flex-col gap-2 border-b border-hairline px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Users aria-hidden="true" className="size-5 shrink-0 text-brand-fg" />
            <p className="truncate text-base leading-[1.4] font-semibold text-fg xl:text-lg">{t("lesson.live.rosterTitle")}</p>
            {preparationMode ? (
              <Chip size="sm" tone="info">
                {preparationFreeExplore ? t("lesson.live.rosterPreview") : t("lesson.live.rosterMock")}
              </Chip>
            ) : null}
          </div>
          <p className="shrink-0 text-sm text-fg-muted">
            {statusVisible ? (
              <>
                <span className={cn("text-lg font-semibold tabular-nums", complete ? "text-success-fg" : "text-fg")}>
                  {answeredCount}/{byScore.length}
                </span>{" "}
                {labels.count}
              </>
            ) : (
              <>
                <span className="text-lg font-semibold text-fg tabular-nums">{byScore.length}</span> {t("lesson.interactive.peopleUnit")}
              </>
            )}
          </p>
        </div>
        {statusVisible && byScore.length > 0 ? (
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-track">
            <div
              className={cn(
                "h-full w-full origin-left rounded-full transition-transform duration-500 ease-(--ease-out)",
                complete ? "bg-success-solid" : "bg-brand-vivid",
              )}
              style={{ transform: `scaleX(${answeredCount / byScore.length})` }}
            />
          </div>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-(--radius-tile) bg-tile-neutral text-icon-neutral">
            <Users className="size-5" />
          </span>
          <p className="text-sm text-fg-muted">{t("lesson.live.rosterEmpty")}</p>
        </div>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto">
          {sorted.map((p, i) => {
            const answered = answeredIds.has(p.studentId);
            const offline = Boolean(p.offlineSince);
            return (
              <li
                key={p.studentId || i}
                className={cn(
                  "flex min-h-14 items-center gap-3 px-4 py-2",
                  i > 0 && "border-t border-hairline",
                  statusVisible && answered && "bg-surface-muted/60",
                )}
              >
                {!statusVisible ? (
                  <span className="w-5 shrink-0 text-center text-sm font-semibold text-fg-subtle tabular-nums">{rankOf.get(p) ?? i + 1}</span>
                ) : null}
                <UserAvatar name={p.name} src={p.pictureUrl} toneKey={p.studentId} size="nav" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base leading-[1.4] font-medium text-fg" title={p.name}>
                    {p.name}
                  </p>
                  {offline && !answered ? (
                    <p className="flex min-w-0 items-center gap-1 text-[0.8125rem] font-medium text-warning-fg">
                      <WifiOff aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="truncate">{t("lesson.live.statusOffline")}</span>
                    </p>
                  ) : statusVisible ? (
                    <p className={cn("flex min-w-0 items-center gap-1 text-[0.8125rem]", answered ? "font-medium text-success-fg" : "text-fg-muted")}>
                      {answered ? (
                        <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.6} />
                      ) : (
                        <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                      )}
                      <span className="truncate">{answered ? labels.done : labels.waiting}</span>
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-right leading-none">
                  <span className="block text-lg font-semibold text-fg tabular-nums">{p.score || 0}</span>
                  <span className="text-xs text-fg-muted">{t("lesson.live.pointsShort")}</span>
                </p>
                {onRemoveStudent ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemoveStudent(p)}
                    aria-label={`${t("lesson.live.removeTitle")} ${p.name}`}
                    title={t("lesson.live.removeTitle")}
                    className="-mr-2 shrink-0 text-fg-subtle hover:text-danger-fg"
                  >
                    <UserMinus aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Surface>
  );
}
