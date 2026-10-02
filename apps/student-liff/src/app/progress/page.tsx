"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Flame, LockKeyhole, Sparkles } from "lucide-react";
import {
  Chip,
  EmptyState,
  ErrorState,
  FilterChip,
  HScroll,
  Notice,
  PageHeader,
  Screen,
  StatTile,
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

  const header = (actions?: ReactNode) => <PageHeader title={t("progress.title")} actions={actions} />;

  if (!isReady || isLoading) return <ProgressSkeleton />;

  if (!profile) {
    return (
      <Screen>
        {header()}
        <LiffErrorState className="flex-1 justify-center" />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        {header()}
        {liffError ? (
          <LiffErrorState className="flex-1 justify-center" />
        ) : (
          <ErrorState
            description={t("progress.loadFailed")}
            onRetry={() => void refetch()}
            retrying={isValidating}
            className="flex-1 justify-center"
          />
        )}
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
        hasData ? (
          <Chip tone="brand" size="md" icon={Sparkles}>
            {stats.cefr}
          </Chip>
        ) : null,
      )}

      <div className="flex flex-col gap-5 px-4 pb-6">
        {enrolledClasses.length > 1 || bookCycles.length > 1 ? (
          <div className="flex flex-col gap-2">
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
                      className="size-2 shrink-0 rounded-full ring-2 ring-white/60"
                      style={{ background: item.seriesColor }}
                    />
                    {item.name}
                    <span className="text-xs opacity-80">{item.cefr}</span>
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
                    className={book.hasAccess ? undefined : "text-fg-muted opacity-70"}
                  >
                    {book.title}
                    <span className="text-xs tabular-nums opacity-80">
                      {book.completedArticles}/{book.totalArticles}
                    </span>
                    {book.hasAccess ? null : <span className="sr-only">{t("progress.lockedAria")}</span>}
                  </FilterChip>
                ))}
              </HScroll>
            ) : null}
          </div>
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

        <div
          aria-busy={switching || undefined}
          className={cn(
            "flex flex-col gap-5 transition-opacity duration-200",
            switching && "pointer-events-none opacity-50",
          )}
        >
          {hasData ? (
            <ProgressHero stats={stats} currentArticle={currentArticle} />
          ) : (
            <div className="rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
              <EmptyState
                icon={BookOpen}
                title={t("progress.noEnrollment")}
                description={t("progress.noEnrollmentSub")}
                action={
                  <Link href="/classes" className={buttonVariants({ variant: "brand", size: "touch" })}>
                    {t("progress.findClass")}
                  </Link>
                }
              />
            </div>
          )}

          {stats.isBookComplete && data.nextAvailableBookCycleId ? (
            <Button variant="brand" size="cta" className="w-full" onClick={() => apply(selectNextBook(data, requested))}>
              {t("progress.nextBook")}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : null}

          <section aria-label={t("progress.statsAria")} className="grid grid-cols-3 gap-2">
            <StatTile icon={Flame} tone="amber" value={stats.weekStreak} label={t("progress.weekStreak")} />
            <StatTile icon={Clock3} tone="blue" value={stats.totalMinutes} label={t("progress.studyMinutes")} />
            <StatTile icon={CheckCircle2} tone="brand" value={stats.articlesRead} label={t("progress.completedLessons")} />
          </section>

          <WeeklyActivityCard weeklyActivity={weeklyActivity} />

          <LessonList
            articles={articles}
            bookCycleId={data.selectedBookCycleId}
            articlesRead={stats.articlesRead}
            totalArticles={stats.totalArticles}
          />
        </div>
      </div>
    </Screen>
  );
}
