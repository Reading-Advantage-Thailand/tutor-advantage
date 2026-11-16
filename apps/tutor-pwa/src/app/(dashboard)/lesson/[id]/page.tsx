import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, ClipboardCheck, GraduationCap, ListChecks, Play, QrCode, Settings } from "lucide-react";
import { Chip, IconTile, ProgressBar, type TileTone } from "@/components/app/Atoms";
import { EmptyState } from "@/components/app/Feedback";
import { LessonContent } from "@/components/app/LessonShell";
import { PageHeader, Section } from "@/components/app/Page";
import { Skeleton } from "@/components/app/Skeletons";
import { ListGroup, ListRow, Surface } from "@/components/app/Surface";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { ArticlesLoadError } from "./_components/ArticlesLoadError";
import { LessonCover } from "./_components/LessonCover";
import { fill, getLessonProgress, getNextArticle, lessonStartHref, type LessonArticle, type LessonProgress } from "./_lib/articles";
import { getLessonArticles, getLessonClass } from "./_lib/server";

/**
 * Lesson hub (patterns.md §0 order: what the tutor came to do first). The
 * next lesson is the hero card (cover, the chapter number, title, the book
 * progress well and the page's one primary "เริ่มสอนบทนี้"); it streams in
 * because the article list is slow. Beside it on desktop (below on phones)
 * the shortcuts as list rows, then the 3-step how-to as numbered tone tiles.
 */
export default async function LessonHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params;
  const cls = await getLessonClass(classId);

  const actions: { href: string; icon: typeof Play; tone: TileTone; title: string; description: string }[] = [
    {
      href: `/lesson/${classId}/select`,
      icon: ListChecks,
      tone: "brand",
      title: t("lesson.preflow.hub.selectTitle"),
      description: t("lesson.preflow.hub.selectDescription"),
    },
    {
      href: `/lesson/${classId}/prepare`,
      icon: GraduationCap,
      tone: "purple",
      title: t("lesson.preflow.hub.prepareTitle"),
      description: t("lesson.preflow.hub.prepareDescription"),
    },
    {
      href: `/dashboard/classes/${classId}`,
      icon: Settings,
      tone: "neutral",
      title: t("lesson.preflow.hub.settingsTitle"),
      description: t("lesson.preflow.hub.settingsDescription"),
    },
  ];

  const steps: { icon: typeof Play; tone: TileTone; title: string; description: string }[] = [
    { icon: BookOpen, tone: "teal", title: t("lesson.selectLesson"), description: t("lesson.selectLessonStepDescription") },
    { icon: QrCode, tone: "blue", title: t("lesson.shareClassLink"), description: t("lesson.shareClassLinkDescription") },
    { icon: Play, tone: "purple", title: t("lesson.teach"), description: t("lesson.teachDescription") },
  ];

  return (
    <LessonContent width="wide">
      <PageHeader
        title={cls?.name ?? t("lesson.manageTitle")}
        description={t("lesson.preflow.hub.description")}
        meta={cls?.bookTitle ? <Chip icon={BookOpen}>{cls.bookTitle}</Chip> : null}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Suspense fallback={<NextLessonSkeleton />}>
          <NextLesson classId={classId} />
        </Suspense>

        <Section title={t("lesson.preflow.hub.quickActions")} className="xl:-mt-2">
          <ListGroup aria-label={t("lesson.preflow.hub.quickActions")}>
            {actions.map((action) => (
              <ListRow
                key={action.href}
                href={action.href}
                leading={<IconTile icon={action.icon} tone={action.tone} />}
                title={action.title}
                subtitle={action.description}
              />
            ))}
          </ListGroup>
        </Section>
      </div>

      <Section title={t("lesson.preflow.hub.howTitle")}>
        <Surface padding="none">
          <ol className="grid divide-y divide-hairline md:grid-cols-3 md:divide-x md:divide-y-0">
            {steps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3.5 p-4 md:p-5">
                <span className="relative shrink-0">
                  <IconTile icon={step.icon} tone={step.tone} />
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-surface text-xs font-semibold text-fg tabular-nums shadow-[0_0_0_1.5px_var(--clay-rim)]"
                  >
                    {index + 1}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block type-card text-fg">
                    <span className="sr-only">{index + 1}. </span>
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-sm leading-[1.6] text-fg-muted">{thaiCopy(step.description)}</span>
                </span>
              </li>
            ))}
          </ol>
        </Surface>
      </Section>
    </LessonContent>
  );
}

/** "สอนแล้ว 5 จาก 14 บท" + the bar + percent, in a well inside the hero card. */
function BookProgressWell({ progress }: { progress: LessonProgress }) {
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-ctl) bg-surface-muted px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-label text-fg-muted tabular">
          {fill(t("lesson.preflow.chaptersProgress"), { done: progress.done, total: progress.total })}
        </span>
        <span className="text-sm font-semibold text-fg tabular">{progress.percent}%</span>
      </div>
      <ProgressBar value={progress.percent} label={t("lesson.preflow.completed")} />
    </div>
  );
}

async function NextLesson({ classId }: { classId: string }) {
  let articles: LessonArticle[];
  try {
    articles = await getLessonArticles(classId);
  } catch (error) {
    console.error("[lesson/hub] failed to load class articles", error);
    return <ArticlesLoadError />;
  }

  if (articles.length === 0) {
    return (
      <EmptyState
        mascot
        icon={BookOpen}
        title={t("lesson.preflow.hub.noArticlesTitle")}
        description={t("lesson.preflow.hub.noArticlesBody")}
        action={
          <Button variant="tonal" size="lg" render={<Link href={`/dashboard/classes/${classId}`} />} nativeButton={false}>
            {t("lesson.preflow.hub.openClass")}
          </Button>
        }
      />
    );
  }

  const progress = getLessonProgress(articles);
  const next = getNextArticle(articles);

  if (!next) {
    return (
      <Surface as="section" padding="lg" aria-labelledby="all-done-title" className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <IconTile icon={ClipboardCheck} tone="brand" size="xl" />
          <div className="min-w-0 flex-1">
            <h2 id="all-done-title" className="type-section text-balance-th text-fg">
              {t("lesson.preflow.hub.allDoneTitle")}
            </h2>
            <p className="mt-0.5 text-sm leading-[1.6] text-fg-muted">{thaiCopy(t("lesson.preflow.hub.allDoneBody"))}</p>
          </div>
        </div>
        <BookProgressWell progress={progress} />
        <Button size="xl" render={<Link href={`/lesson/${classId}/select`} />} nativeButton={false} className="w-full sm:w-auto sm:self-start">
          <ListChecks aria-hidden="true" />
          {t("lesson.preflow.hub.selectTitle")}
        </Button>
      </Surface>
    );
  }

  const chapter = fill(t("lesson.preflow.chapter"), { n: next.articleNumber });
  return (
    <Surface as="section" padding="none" aria-labelledby="next-lesson-title" className="overflow-hidden">
      <div className="grid sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <LessonCover
          src={next.imageUrl}
          alt={fill(t("lesson.preflow.coverAlt"), { title: next.title })}
          seed={next.articleNumber}
          eager
          className="aspect-[16/9] w-full sm:aspect-auto sm:h-full sm:min-h-64"
          iconClassName="size-12"
        />
        <div className="flex min-w-0 flex-col gap-4 p-5 md:p-6">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="flex size-16 shrink-0 flex-col items-center justify-center rounded-(--radius-tile) bg-brand-soft text-brand-soft-fg"
            >
              <span className="text-xs leading-none font-medium">{fill(t("lesson.preflow.chapter"), { n: "" }).trim()}</span>
              <span className="mt-1 font-heading text-[1.75rem] leading-none font-semibold">{next.articleNumber}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="type-label font-semibold text-brand-fg">
                {t("lesson.preflow.hub.nextTitle")}
                <span className="sr-only"> · {chapter}</span>
              </p>
              <h2 id="next-lesson-title" lang="en" className="mt-0.5 text-[1.375rem] leading-[1.35] font-semibold text-balance-th text-fg md:text-2xl">
                {next.title}
              </h2>
            </div>
          </div>
          <div className="min-w-0">
            {next.summary ? <p className="line-clamp-2 text-sm leading-[1.6] text-fg-muted">{next.summary}</p> : null}
            {next.cefrLevel ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Chip tone="info">{fill(t("lesson.preflow.cefr"), { level: next.cefrLevel })}</Chip>
              </div>
            ) : null}
          </div>
          <BookProgressWell progress={progress} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button size="xl" render={<Link href={lessonStartHref(classId, next.id, null)} />} nativeButton={false} className="sm:min-w-52">
              <Play aria-hidden="true" />
              {t("lesson.preflow.hub.startThis")}
            </Button>
            <Button
              size="xl"
              variant="outline"
              render={<Link href={`/lesson/${classId}/prepare?articleId=${encodeURIComponent(next.id)}`} />}
              nativeButton={false}
            >
              <GraduationCap aria-hidden="true" />
              {t("lesson.preflow.hub.rehearseThis")}
            </Button>
          </div>
        </div>
      </div>
    </Surface>
  );
}

function NextLessonSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-(--radius-card) border border-clay-rim bg-surface shadow-card">
      <div className="grid sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <Skeleton className="aspect-[16/9] h-auto w-full rounded-none sm:aspect-auto sm:h-full sm:min-h-64" />
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-16 shrink-0 rounded-(--radius-tile)" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-7 w-3/4" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16 w-full rounded-(--radius-ctl)" />
          <div className="flex gap-2">
            <Skeleton className="h-12 w-52 rounded-(--radius-ctl)" />
            <Skeleton className="h-12 w-36 rounded-(--radius-ctl)" />
          </div>
        </div>
      </div>
    </div>
  );
}
