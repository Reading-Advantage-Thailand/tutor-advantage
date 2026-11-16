"use client";

import { BookOpen, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  EmptyState,
  ErrorState,
  FilterChip,
  HScroll,
  LevelChip,
  ListGroup,
  ListRow,
  ListRowSkeleton,
  Notice,
  ProgressBar,
  SectionHeader,
  Surface,
} from "@/components/mobile";
import { normalizeCefr } from "@/lib/cefr";
import { classifyClassLoadError, getArticleRowHref, getLessonListFooter, type ClassAccess } from "@/lib/classAccess";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { getSequentialLessonPlan, isLessonOpenable, type LessonLockState } from "@/lib/lessonLock";
import { cn } from "@/lib/utils";
import type { ClassArticleDetail, ClassDetail } from "./types";

export interface ArticlesState {
  data: ClassArticleDetail[] | undefined;
  error: unknown;
  isLoading: boolean;
  isValidating: boolean;
  refetch: () => void;
}

type LessonRowArticle = Pick<ClassArticleDetail, "id" | "articleNumber" | "title" | "isCompleted"> & {
  cefrLevel?: string | null;
  showCefr?: boolean;
};

/**
 * Numbered tile (patterns.md S5.4): done = success tile + check, current =
 * jade tile with the number, locked = neutral tile with the number. Reading
 * face, tabular (list rows never use Kodchasan).
 */
function LessonNumber({
  number,
  completed,
  current,
  locked,
}: {
  number: number;
  completed: boolean;
  current: boolean;
  locked: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 items-center justify-center rounded-[12px] text-[15px] leading-none font-semibold tabular-nums",
        completed
          ? "bg-success-bg text-success-fg"
          : current
            ? "bg-brand-solid text-on-brand"
            : locked
              ? "bg-tile-neutral text-icon-neutral"
              : "bg-tile-brand text-icon-brand",
      )}
    >
      {completed ? <Check className="size-5" strokeWidth={2.6} /> : number}
    </span>
  );
}

/**
 * One lesson. `state` comes from the shared sequential unlock rule
 * (lib/lessonLock, same as /progress): done → check + "เรียนแล้ว", current →
 * "ยังไม่ได้เรียน" + chevron to the reader, locked → muted with a lock and a tap
 * that explains which lesson to finish first. Without access to the book
 * (`canRead` false) every row is a static locked peek.
 */
function LessonRow({
  article,
  canRead,
  state = "current",
  onLockedTap,
}: {
  article: LessonRowArticle;
  canRead: boolean;
  state?: LessonLockState;
  onLockedTap?: () => void;
}) {
  const cefr = article.showCefr === false ? null : normalizeCefr(article.cefrLevel);
  const locked = !canRead || !isLessonOpenable(state);
  const completed = canRead && state === "done";
  const lockedBySequence = canRead && locked;
  // The lesson to do next: tinted row with a jade bar (aria-current), as on /progress.
  const current = canRead && !locked && state === "current";
  return (
    <ListRow
      href={locked ? undefined : getArticleRowHref(article.id, canRead)}
      onClick={lockedBySequence ? onLockedTap : undefined}
      current={current}
      leading={<LessonNumber number={article.articleNumber} completed={completed} current={current} locked={locked} />}
      title={locked ? <span className="text-fg-muted">{article.title}</span> : article.title}
      subtitle={
        canRead ? (
          completed ? (
            <span className="text-success-fg">{t("classes.detail.lessonCompleted")}</span>
          ) : locked ? (
            <span className="text-fg-subtle">{t("classes.detail.lessonLocked")}</span>
          ) : (
            t("classes.detail.lessonPending")
          )
        ) : undefined
      }
      trailing={
        cefr || locked ? (
          <>
            {cefr ? <LevelChip cefr={cefr} /> : null}
            {locked ? (
              <>
                <Lock aria-hidden="true" className="size-4 text-fg-subtle" />
                <span className="sr-only">{t("classes.detail.lockedAria")}</span>
              </>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}

function LessonsBody({ articles, canRead }: { articles: ArticlesState; canRead: boolean }) {
  if (articles.isLoading) {
    return (
      <ListGroup>
        <ListRowSkeleton count={4} />
      </ListGroup>
    );
  }
  if (articles.error && !articles.data) {
    return (
      <ErrorState
        card
        headingLevel="h4"
        title={t("classes.detail.lessonsLoadFailed")}
        kind={classifyClassLoadError(articles.error) === "offline" ? "offline" : "error"}
        onRetry={articles.refetch}
        retrying={articles.isValidating}
        className="py-6"
      />
    );
  }
  const list = articles.data ?? [];
  if (list.length === 0) {
    return (
      <EmptyState card icon={BookOpen} tone="neutral" headingLevel="h4" title={t("classes.detail.lessonsEmpty")} className="py-6" />
    );
  }
  const ordered = [...list].sort((a, b) => a.articleNumber - b.articleNumber);
  const { currentIndex, states } = getSequentialLessonPlan(
    ordered.map((article) => ({ done: article.isCompleted })),
  );
  const current = currentIndex >= 0 ? ordered[currentIndex] : undefined;
  const explainLock = () => {
    if (!current) return;
    toast.info(thaiCopy(`${t("progress.lockedLessonPrefix")} ${current.articleNumber} ${t("progress.lockedLessonSuffix")}`));
  };
  return (
    <ListGroup aria-label={t("classes.detail.lessonsTitle")}>
      {ordered.map((article, index) => (
        <LessonRow
          key={article.id}
          article={article}
          canRead={canRead}
          state={states[index]}
          onLockedTap={explainLock}
        />
      ))}
    </ListGroup>
  );
}

/**
 * Enrolled layout: book picker (when the class has several books), progress
 * in the selected book and its lessons.
 */
export function LessonsSection({
  cls,
  access,
  selectedCycleId,
  onSelectCycle,
  articles,
}: {
  cls: ClassDetail;
  access: ClassAccess;
  selectedCycleId: string;
  onSelectCycle: (cycleId: string) => void;
  articles: ArticlesState;
}) {
  const cycles = cls.bookCycles ?? [];
  const selected = access.selectedCycle;
  const progress = access.canReadSelectedCycle ? selected?.progress : null;
  const showProgress = Boolean(progress && progress.totalArticles > 0);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        as="h3"
        title={t("classes.detail.lessonsTitle")}
        count={access.canReadSelectedCycle && articles.data ? articles.data.length : undefined}
        className="-mb-1"
      />

      {cycles.length > 1 ? (
        <div id="class-book-cycle">
          <HScroll aria-label={t("classes.detail.bookPickerAria")}>
            {cycles.map((cycle) => (
              <FilterChip
                key={cycle.id}
                selected={cycle.id === selectedCycleId}
                onClick={() => onSelectCycle(cycle.id)}
                icon={cycle.hasAccess ? undefined : Lock}
              >
                {`${t("classes.detail.bookPrefix")} ${cycle.sequence}`}
              </FilterChip>
            ))}
          </HScroll>
        </div>
      ) : null}

      {/* Progress card (patterns.md S5.3): the selected book, "เรียนแล้ว 5 จาก 14 บท", percent and bar. */}
      {progress && showProgress ? (
        <Surface>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {selected?.title ? (
                <p className="text-sm leading-[1.6] font-medium text-fg-muted">{selected.title}</p>
              ) : null}
              <p className="text-base leading-[1.6] font-semibold text-fg">
                {t("classes.detail.progressPrefix")} {progress.completedArticles} {t("classes.detail.progressFrom")}{" "}
                {progress.totalArticles} {t("classes.detail.lessonsUnit")}
              </p>
            </div>
            <span className="shrink-0 text-xl leading-[1.3] font-semibold text-brand-fg tabular-nums">
              {progress.percent}%
            </span>
          </div>
          <ProgressBar value={progress.percent} className="mt-3" />
        </Surface>
      ) : selected?.title ? (
        <p className="text-sm leading-[1.6] text-fg-muted">{selected.title}</p>
      ) : null}

      {access.selectedCycleLocked ? (
        <Notice
          tone="warning"
          icon={Lock}
          title={t("classes.detail.cycleLockedTitle")}
          description={t("classes.detail.cycleLockedDescription")}
        />
      ) : (
        <LessonsBody articles={articles} canRead={access.canReadSelectedCycle} />
      )}
    </section>
  );
}

/**
 * Sales layout: a locked peek at the course's lessons (the loaded lessons, or
 * the first titles the class endpoint sends) and how many more there are.
 */
export function CoursePreviewSection({
  cls,
  articles,
  articlesRequested,
}: {
  cls: ClassDetail;
  articles: ArticlesState;
  /** False when the selected book is locked, so its lessons were never requested. */
  articlesRequested: boolean;
}) {
  const loaded = articlesRequested ? articles.data : undefined;
  const rows: LessonRowArticle[] = loaded?.length
    ? loaded
    : (cls.articles ?? []).map((article) => ({
        id: article.id,
        articleNumber: article.no,
        title: article.title,
        isCompleted: false,
      }));
  const articleCount = cls.articleCount ?? rows.length;
  const footer = getLessonListFooter(articleCount, rows.length, false);
  const loading = articlesRequested && articles.isLoading;

  if (!loading && rows.length === 0) return null;

  return (
    <section>
      <SectionHeader as="h3" title={t("classes.detail.coursePreviewTitle")} count={articleCount || undefined} />
      <div className="mt-1">
        {loading ? (
          <ListGroup>
            <ListRowSkeleton count={3} />
          </ListGroup>
        ) : (
          <ListGroup
            footerIcon={Lock}
            footer={
              footer
                ? footer.kind === "more"
                  ? `${t("classes.detail.moreLessonsPrefix")} ${footer.remaining} ${t("classes.detail.moreLessonsSuffix")}`
                  : t("classes.detail.allLessonsAfterPayment")
                : undefined
            }
          >
            {rows.map((article) => (
              <LessonRow key={article.id} article={article} canRead={false} />
            ))}
          </ListGroup>
        )}
      </div>
    </section>
  );
}
