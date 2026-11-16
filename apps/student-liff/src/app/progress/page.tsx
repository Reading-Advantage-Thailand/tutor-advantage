"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowRight, BookOpen, Flame, LockKeyhole } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  FilterChip,
  HeroOverlap,
  HScroll,
  LevelChip,
  Notice,
  Screen,
  StatStrip,
} from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import { progressResourceKey } from "@/lib/resourceKeys";
import { cn } from "@/lib/utils";
import { LiffErrorState } from "../dashboard/_components/LiffErrorState";
import { LessonList } from "./_components/LessonList";
import { BookCompleteCelebration } from "./_components/BookCompleteCelebration";
import { ProgressHeader } from "./_components/ProgressHeader";
import { ProgressHero } from "./_components/ProgressHero";
import { ProgressSkeleton } from "./_components/ProgressSkeleton";
import { WeeklyActivityCard } from "./_components/WeeklyActivityCard";
import {
  AUTO_SELECTION,
  getDisplayedSelection,
  getLessonPlan,
  hasProgressData,
  selectBook,
  selectClass,
  selectNextBook,
  type BookCycleOption,
  type ProgressData,
  type ProgressSelection,
} from "./_components/progressModel";

export default function ProgressPage() {
  const { isReady, profile, error: liffError } = useLiff();
  // Only user taps change this; the server's resolved class/book comes back in `data`.
  const [requested, setRequested] = useState<ProgressSelection>(AUTO_SELECTION);
  const { data, error, isLoading, isValidating, isPreviousData, refetch } = useCachedResource<ProgressData>(
    profile ? progressResourceKey(profile.userId, requested.classId, requested.cycleId) : null,
    () =>
      studentApi.getStudentProgress(requested.classId || undefined, requested.cycleId || undefined) as Promise<ProgressData>,
    { enabled: isReady, keepPreviousData: true },
  );

  const header = (actions?: ReactNode, children?: ReactNode) => <ProgressHeader actions={actions}>{children}</ProgressHeader>;

  if (!isReady || isLoading) return <ProgressSkeleton />;

  if (!profile) {
    return (
      <Screen>
        {header()}
        <HeroOverlap>
          <LiffErrorState card />
        </HeroOverlap>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        {header()}
        <HeroOverlap>
          {liffError ? (
            <LiffErrorState card />
          ) : (
            <ErrorState card description={t("progress.loadFailed")} onRetry={() => void refetch()} retrying={isValidating} />
          )}
        </HeroOverlap>
      </Screen>
    );
  }

  const { stats, articles, weeklyActivity, bookCycles = [] } = data;
  const enrolledClasses = data.enrolledClasses ?? [];
  const hasData = hasProgressData(data);
  const { currentArticle } = getLessonPlan(articles);
  const switching = isPreviousData;
  const shown = getDisplayedSelection(data, requested, switching);

  const apply = (next: ProgressSelection | null) => {
    if (next) setRequested(next);
  };
  const chooseBook = (book: BookCycleOption) => {
    if (!book.hasAccess) {
      toast.info(t("progress.lockedBook"), { description: t("progress.lockedBookSub") });
      return;
    }
    apply(selectBook(data, requested, book, shown.cycleId));
  };

  return (
    <Screen>
      {header(
        hasData ? <LevelChip cefr={stats.cefr} size="md" /> : null,
        enrolledClasses.length > 1 || bookCycles.length > 1 || (switching && error) ? (
          <>
            {enrolledClasses.length > 1 ? (
              <HScroll aria-label={t("progress.selectClassAria")}>
                {enrolledClasses.map((item) => (
                  <FilterChip
                    key={item.classId}
                    selected={item.classId === shown.classId}
                    onClick={() => apply(selectClass(data, item.classId, shown.classId))}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full ring-2 ring-surface"
                      style={{ background: item.seriesColor }}
                    />
                    {item.name}
                    <span className="text-xs font-normal">{item.cefr}</span>
                  </FilterChip>
                ))}
              </HScroll>
            ) : null}
            {bookCycles.length > 1 ? (
              <HScroll aria-label={t("progress.selectBookAria")}>
                {bookCycles.map((book) => (
                  <FilterChip
                    key={book.id}
                    selected={book.id === shown.cycleId}
                    icon={book.hasAccess ? BookOpen : LockKeyhole}
                    onClick={() => chooseBook(book)}
                    className={book.hasAccess ? undefined : "text-fg-muted"}
                  >
                    {book.title}
                    <span className="text-xs font-normal tabular-nums">
                      {book.completedArticles}/{book.totalArticles}
                    </span>
                    {book.hasAccess ? null : <span className="sr-only">{t("progress.lockedAria")}</span>}
                  </FilterChip>
                ))}
              </HScroll>
            ) : null}
            {switching && error ? (
              <Notice
                tone="danger"
                role="alert"
                title={t("progress.loadFailed")}
                action={
                  <Button variant="brandSoft" size="touch" onClick={() => void refetch()} loading={isValidating}>
                    {t("common.retry")}
                  </Button>
                }
              />
            ) : null}
          </>
        ) : null,
      )}

      <HeroOverlap>
        <div
          aria-busy={switching || undefined}
          className={cn(
            "flex flex-col gap-5 transition-opacity duration-200",
            switching && "pointer-events-none opacity-50",
          )}
        >
          <StatStrip
            aria-label={t("progress.statsAria")}
            numbers="tabular"
            items={[
              // The streak is the view's one sunshine reward (patterns.md S9), shown only once there is one.
              { value: stats.weekStreak, label: t("progress.weekStreak"), tone: stats.weekStreak > 0 ? "sun" : "default", icon: Flame },
              { value: stats.articlesRead, label: t("progress.completedLessons") },
              { value: stats.totalMinutes, label: t("progress.studyMinutes") },
            ]}
          />

          {hasData ? (
            <>
              <ProgressHero
                stats={stats}
                currentArticle={currentArticle}
                primary={!(stats.isBookComplete && data.nextAvailableBookCycleId)}
              />
              <BookCompleteCelebration bookCycleId={data.selectedBookCycleId} isComplete={stats.isBookComplete} />
            </>
          ) : (
            <EmptyState
              card
              icon={BookOpen}
              mascot="sleepy"
              headingLevel="h2"
              title={t("progress.noEnrollment")}
              description={t("progress.noEnrollmentSub")}
              action={
                <Link href="/classes" className={buttonVariants({ variant: "brand", size: "touch" })}>
                  {t("progress.findClass")}
                </Link>
              }
            />
          )}

          {stats.isBookComplete && data.nextAvailableBookCycleId ? (
            <Button variant="brand" size="cta-lg" className="w-full" onClick={() => apply(selectNextBook(data, requested))}>
              {t("progress.nextBook")}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : null}

          <WeeklyActivityCard weeklyActivity={weeklyActivity} />

          <LessonList
            articles={articles}
            bookCycleId={data.selectedBookCycleId}
            articlesRead={stats.articlesRead}
            totalArticles={stats.totalArticles}
          />
        </div>
      </HeroOverlap>
    </Screen>
  );
}
