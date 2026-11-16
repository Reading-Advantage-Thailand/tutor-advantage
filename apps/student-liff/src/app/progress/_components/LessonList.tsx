"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AlertCircle, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, LockKeyhole, Mic } from "lucide-react";
import { Chip, EmptyState, ListGroup, SectionHeader } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { buildReadHref, buildVoicePracticeHref, getLessonPlan, type LessonState, type ProgressArticle } from "./progressModel";

const rowBodyClass =
  "flex min-h-16 min-w-0 flex-1 items-center gap-3.5 px-4 py-3 text-left transition-colors duration-[var(--duration-fast)] focus-visible:outline-offset-[-3px] active:bg-press";

/**
 * Numbered tile (patterns.md S5.4, shared with the class page): done = success
 * tile + check, current = jade tile with the number, locked = neutral tile +
 * lock. Reading face, tabular.
 */
function LessonLeading({ article, state }: { article: ProgressArticle; state: LessonState }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-[12px] text-[15px] leading-none font-semibold tabular-nums",
        state === "done"
          ? "bg-success-bg text-success-fg"
          : state === "locked"
            ? "bg-tile-neutral text-icon-neutral"
            : "bg-brand-solid text-on-brand",
      )}
    >
      {state === "done" ? (
        <Check className="size-5" strokeWidth={2.6} />
      ) : state === "locked" ? (
        <LockKeyhole className="size-[18px]" strokeWidth={2.2} />
      ) : (
        article.no
      )}
    </span>
  );
}

function LessonText({ article, state }: { article: ProgressArticle; state: LessonState }) {
  const unlocked = state !== "locked";
  return (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-[1.6] text-fg-muted">
        <span className="tabular-nums">
          {t("progress.lessonPrefix")} {article.no}
        </span>
        {state === "done" ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock3 aria-hidden="true" className="size-3.5" />
            {article.minutes} {t("progress.minuteUnit")}
          </span>
        ) : null}
        {state === "current" ? <Chip tone="brand" dot>{t("progress.currentLesson")}</Chip> : null}
      </span>
      <span
        className={cn(
          "t-row line-clamp-2 block",
          state === "current" ? "text-brand-soft-fg" : unlocked ? "text-fg" : "text-fg-muted",
        )}
      >
        {article.title}
      </span>
      {unlocked && article.assessmentSupported ? (
        <span
          className={cn(
            "mt-0.5 inline-flex items-center gap-1 text-[13px] leading-[1.6] font-semibold",
            article.assessmentDone ? "text-success-fg" : "text-warning-fg",
          )}
        >
          {article.assessmentDone ? (
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
          ) : (
            <AlertCircle aria-hidden="true" className="size-3.5" />
          )}
          {article.assessmentDone ? t("progress.assessmentDone") : t("progress.assessmentPending")}
        </span>
      ) : null}
    </span>
  );
}

interface LessonRowProps {
  article: ProgressArticle;
  state: LessonState;
  /** Reedy link for finished lessons (needs the server's book cycle id). */
  voiceHref: string | null;
  onLockedTap: () => void;
}

/** One lesson: the main area opens the reader (or explains the lock); finished lessons get a "ฝึกพูด" button beside it. */
function LessonRow({ article, state, voiceHref, onLockedTap }: LessonRowProps) {
  let main: ReactNode;
  if (state === "locked") {
    main = (
      <button
        type="button"
        onClick={onLockedTap}
        aria-label={`${t("progress.lessonPrefix")} ${article.no} ${article.title} (${t("progress.lockedAria")})`}
        className={rowBodyClass}
      >
        <LessonLeading article={article} state={state} />
        <LessonText article={article} state={state} />
      </button>
    );
  } else {
    main = (
      <Link
        href={buildReadHref(article.id)}
        aria-current={state === "current" ? "true" : undefined}
        className={rowBodyClass}
      >
        <LessonLeading article={article} state={state} />
        <LessonText article={article} state={state} />
        {voiceHref ? null : <ChevronRight aria-hidden="true" className="-mr-1 size-5 shrink-0 text-fg-subtle" />}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "list-row flex items-center",
        // The lesson to do next: soft jade with a 3px jade bar on the leading edge (components.md §3.2).
        state === "current" && "bg-brand-soft shadow-[inset_3px_0_0_var(--brand-solid)]",
      )}
      data-leading=""
    >
      {main}
      {voiceHref ? (
        <Link
          href={voiceHref}
          aria-label={`${t("progress.voicePracticeAria")} ${article.no}`}
          className="pressable mr-3 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-tile-purple px-3.5 text-sm leading-[1.4] font-semibold text-icon-purple"
        >
          <Mic aria-hidden="true" className="size-4" />
          {t("progress.voicePractice")}
        </Link>
      ) : null}
    </div>
  );
}

export interface LessonListProps {
  articles: ProgressArticle[];
  /** Server-resolved book cycle (voice practice needs it). */
  bookCycleId: string | null | undefined;
  articlesRead: number;
  totalArticles: number;
}

/** "บทเรียนทั้งหมด": done / current / locked lessons with the original unlock rule (S4 rows in one card). */
export function LessonList({ articles, bookCycleId, articlesRead, totalArticles }: LessonListProps) {
  const { states, currentArticle } = getLessonPlan(articles);

  const explainLock = () => {
    if (!currentArticle) return;
    toast.info(thaiCopy(`${t("progress.lockedLessonPrefix")} ${currentArticle.no} ${t("progress.lockedLessonSuffix")}`));
  };

  return (
    <section aria-labelledby="progress-lessons-title" className="flex flex-col gap-1">
      <SectionHeader
        id="progress-lessons-title"
        title={t("progress.allLessons")}
        trailing={
          <Chip size="md" className="font-sans tabular-nums">
            {articlesRead}/{totalArticles}
          </Chip>
        }
      />
      {articles.length === 0 ? (
        // Plain tile, no Reedy: the page's empty card already has the screen's one Reedy.
        <EmptyState card icon={BookOpen} headingLevel="h3" mascot={false} title={t("progress.noLessonsYet")} className="py-8" />
      ) : (
        <ListGroup>
          {articles.map((article, index) => (
            <LessonRow
              key={article.id}
              article={article}
              state={states[index]}
              voiceHref={article.done && bookCycleId ? buildVoicePracticeHref(bookCycleId, article.id) : null}
              onLockedTap={explainLock}
            />
          ))}
        </ListGroup>
      )}
    </section>
  );
}
