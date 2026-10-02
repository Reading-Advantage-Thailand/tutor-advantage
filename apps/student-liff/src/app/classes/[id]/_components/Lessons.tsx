"use client";

import { BookOpen, Check, Lock } from "lucide-react";
import {
  Chip,
  EmptyState,
  ErrorState,
  FilterChip,
  HScroll,
  ListGroup,
  ListRow,
  ListRowSkeleton,
  Notice,
  ProgressBar,
  SectionHeader,
  Surface,
  iconTileToneClass,
} from "@/components/mobile";
import { cefrTone, normalizeCefr } from "@/lib/cefr";
import { classifyClassLoadError, getArticleRowHref, getLessonListFooter, type ClassAccess } from "@/lib/classAccess";
import { t } from "@/lib/i18n";
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

function LessonNumber({ number, completed, locked }: { number: number; completed: boolean; locked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
        completed ? "bg-success-bg text-success-fg" : locked ? "bg-fill-muted text-fg-muted" : "bg-tile-brand text-icon-brand",
      )}
    >
      {completed ? <Check className="size-5" strokeWidth={2.6} /> : number}
    </span>
  );
}

/**
 * One lesson. Navigable (→ /student/read/:id) only when the student can read
 * the selected book; otherwise static with a lock. Completed lessons get a check.
 */
function LessonRow({ article, canRead }: { article: LessonRowArticle; canRead: boolean }) {
  const cefr = article.showCefr === false ? null : normalizeCefr(article.cefrLevel);
  const completed = canRead && article.isCompleted;
  return (
    <ListRow
      href={getArticleRowHref(article.id, canRead)}
      leading={<LessonNumber number={article.articleNumber} completed={completed} locked={!canRead} />}
      title={article.title}
      subtitle={
        canRead ? (completed ? t("classes.detail.lessonCompleted") : t("classes.detail.lessonPending")) : undefined
      }
      trailing={
        cefr || !canRead ? (
          <>
            {cefr ? <Chip className={iconTileToneClass[cefrTone(cefr)]}>{cefr}</Chip> : null}
            {canRead ? null : (
              <>
                <Lock aria-hidden="true" className="size-4 text-fg-subtle" />
                <span className="sr-only">{t("classes.detail.lockedAria")}</span>
              </>
            )}
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
      <Surface padding="none">
        <ErrorState
          title={t("classes.detail.lessonsLoadFailed")}
          kind={classifyClassLoadError(articles.error) === "offline" ? "offline" : "error"}
          onRetry={articles.refetch}
          retrying={articles.isValidating}
          className="py-6"
        />
      </Surface>
    );
  }
  const list = articles.data ?? [];
  if (list.length === 0) {
    return (
      <Surface padding="none">
        <EmptyState icon={BookOpen} tone="neutral" title={t("classes.detail.lessonsEmpty")} className="py-6" />
      </Surface>
    );
  }
  return (
    <ListGroup aria-label={t("classes.detail.lessonsTitle")}>
      {list.map((article) => (
        <LessonRow key={article.id} article={article} canRead={canRead} />
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

  return (
    <section>
      <SectionHeader
        as="h3"
        title={t("classes.detail.lessonsTitle")}
        count={access.canReadSelectedCycle && articles.data ? articles.data.length : undefined}
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

      {selected?.title ? <p className="mt-1 text-sm leading-[1.5] text-fg-muted">{selected.title}</p> : null}

      {progress && progress.totalArticles > 0 ? (
        <div className="mt-2">
          <div className="flex items-baseline justify-between gap-3 text-[13px] leading-[1.5]">
            <span className="text-fg-muted">
              {t("classes.detail.progressPrefix")} {progress.completedArticles} {t("classes.detail.progressFrom")}{" "}
              {progress.totalArticles} {t("classes.detail.lessonsUnit")}
            </span>
            <span className="font-bold text-brand-fg tabular-nums">{progress.percent}%</span>
          </div>
          <ProgressBar value={progress.percent} size="sm" className="mt-1.5" />
        </div>
      ) : null}

      <div className="mt-3">
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
      </div>
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
            footer={
              footer?.kind === "more"
                ? `${t("classes.detail.moreLessonsPrefix")} ${footer.remaining} ${t("classes.detail.moreLessonsSuffix")}`
                : footer?.kind === "allAfterPayment"
                  ? t("classes.detail.allLessonsAfterPayment")
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
