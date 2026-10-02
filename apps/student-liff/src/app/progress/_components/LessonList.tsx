"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AlertCircle, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, LockKeyhole, Mic } from "lucide-react";
import { Chip, EmptyState, IconTile, ListGroup } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { buildReadHref, buildVoicePracticeHref, getLessonPlan, type LessonState, type ProgressArticle } from "./progressModel";

const rowBodyClass = "flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors duration-150 active:bg-press";

function LessonLeading({ article, state }: { article: ProgressArticle; state: LessonState }) {
  if (state === "done") return <IconTile icon={Check} tone="brand" shape="circle" />;
  if (state === "locked") return <IconTile icon={LockKeyhole} tone="neutral" shape="circle" />;
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-solid text-[15px] leading-none font-bold text-white tabular-nums"
    >
      {article.no}
    </span>
  );
}

function LessonText({ article, state }: { article: ProgressArticle; state: LessonState }) {
  const unlocked = state !== "locked";
  return (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-[1.5] text-fg-muted">
        <span>
          {t("progress.lessonPrefix")} {article.no}
        </span>
        {state === "done" ? (
          <span className="inline-flex items-center gap-1">
            <Clock3 aria-hidden="true" className="size-3.5" />
            {article.minutes} {t("progress.minuteUnit")}
          </span>
        ) : null}
        {state === "current" ? <Chip tone="brand">{t("progress.currentLesson")}</Chip> : null}
      </span>
      <span
        className={cn(
          "line-clamp-2 block text-[15px] leading-[1.5] font-semibold",
          unlocked ? "text-fg" : "text-fg-muted",
        )}
      >
        {article.title}
      </span>
      {unlocked && article.assessmentSupported ? (
        <span
          className={cn(
            "mt-0.5 inline-flex items-center gap-1 text-xs leading-[1.5] font-semibold",
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
      <Link href={buildReadHref(article.id)} className={rowBodyClass}>
        <LessonLeading article={article} state={state} />
        <LessonText article={article} state={state} />
        {voiceHref ? null : <ChevronRight aria-hidden="true" className="-mr-1 size-5 shrink-0 text-fg-subtle" />}
      </Link>
    );
  }

  return (
    <div className={cn("list-row flex items-center", state === "current" && "bg-brand-soft")} data-leading="">
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

/** "บทเรียนทั้งหมด": done / current / locked lessons with the original unlock rule. */
export function LessonList({ articles, bookCycleId, articlesRead, totalArticles }: LessonListProps) {
  const { states, currentArticle } = getLessonPlan(articles);

  const explainLock = () => {
    if (!currentArticle) return;
    toast.info(`${t("progress.lockedLessonPrefix")} ${currentArticle.no} ${t("progress.lockedLessonSuffix")}`);
  };

  return (
    <section aria-labelledby="progress-lessons-title">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id="progress-lessons-title" className="text-[17px] leading-[1.5] font-bold text-fg">
          {t("progress.allLessons")}
        </h2>
        <Chip size="md" className="tabular-nums">
          {articlesRead}/{totalArticles}
        </Chip>
      </div>
      {articles.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
          <EmptyState icon={BookOpen} title={t("progress.noLessonsYet")} className="py-8" />
        </div>
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
