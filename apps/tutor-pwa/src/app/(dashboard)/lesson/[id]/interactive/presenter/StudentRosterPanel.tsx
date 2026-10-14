"use client";

/**
 * Right-hand roster for the presenter: every student, whether they have
 * answered the current question / submitted the game, and their score.
 * (Replaces the old dark "Leaderboard" sidebar.)
 */
import { Check, Clock3, Users } from "lucide-react";
import { Chip, UserAvatar } from "@/components/app";
import type { Participant } from "@/lib/lesson-types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
  className?: string;
}

export function StudentRosterPanel({
  participants,
  answeredStudentIds = [],
  showAnswerStatus = true,
  preparationMode = false,
  preparationFreeExplore = false,
  statusLabels,
  className,
}: StudentRosterPanelProps) {
  const labels = statusLabels ?? {
    done: t("lesson.live.statusAnswered"),
    waiting: t("lesson.live.statusThinking"),
    count: t("lesson.live.rosterAnswered"),
  };
  const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
  const answeredIds = new Set(answeredStudentIds);
  const answeredCount = sorted.filter((p) => answeredIds.has(p.studentId)).length;
  const statusVisible = showAnswerStatus && !preparationFreeExplore;

  return (
    <aside
      aria-label={t("lesson.live.rosterTitle")}
      className={cn(
        "flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-card lg:w-72",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Users aria-hidden="true" className="size-4 shrink-0 text-brand-fg" />
          <p className="truncate text-base font-semibold text-fg">{t("lesson.live.rosterTitle")}</p>
          {preparationMode ? (
            <Chip size="sm" tone="info">
              {preparationFreeExplore ? t("lesson.live.rosterPreview") : t("lesson.live.rosterMock")}
            </Chip>
          ) : null}
        </div>
        <p className="shrink-0 text-sm text-fg-muted">
          {statusVisible ? (
            <>
              <span className="font-semibold tabular-nums text-fg">{answeredCount}</span>/{sorted.length}{" "}
              {labels.count}
            </>
          ) : (
            <>
              <span className="font-semibold tabular-nums text-fg">{sorted.length}</span> {t("lesson.interactive.peopleUnit")}
            </>
          )}
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-fg-muted">{t("lesson.live.rosterEmpty")}</p>
      ) : (
        <ol className="min-h-0 flex-1 divide-y divide-hairline overflow-y-auto">
          {sorted.map((p, i) => {
            const answered = answeredIds.has(p.studentId);
            return (
              <li key={p.studentId || i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-fg-subtle">{i + 1}</span>
                <UserAvatar name={p.name} src={p.pictureUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-medium text-fg">{p.name}</p>
                  {statusVisible ? (
                    <p className={cn("flex min-w-0 items-center gap-1 text-[0.8125rem]", answered ? "text-success-fg" : "text-fg-subtle")}>
                      {answered ? <Check aria-hidden="true" className="size-3.5 shrink-0" /> : <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />}
                      <span className="truncate">{answered ? labels.done : labels.waiting}</span>
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-right leading-none">
                  <span className="block text-lg font-bold tabular-nums text-fg">{p.score || 0}</span>
                  <span className="text-xs text-fg-subtle">{t("lesson.live.pointsShort")}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
