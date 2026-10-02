import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, ClipboardCheck, GraduationCap, ListChecks, Play, QrCode, Settings } from "lucide-react";
import { Chip, IconTile, ProgressBar, type TileTone } from "@/components/app/Atoms";
import { EmptyState } from "@/components/app/Feedback";
import { LessonContent } from "@/components/app/LessonShell";
import { Grid, PageHeader, Section } from "@/components/app/Page";
import { Skeleton } from "@/components/app/Skeletons";
import { Surface } from "@/components/app/Surface";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { ArticlesLoadError } from "./_components/ArticlesLoadError";
import { LessonCover } from "./_components/LessonCover";
import { fill, getLessonProgress, getNextArticle, lessonStartHref, type LessonArticle } from "./_lib/articles";
import { getLessonArticles, getLessonClass } from "./_lib/server";

/**
 * Lesson hub: what to teach next (streamed, since the article list is slow),
 * shortcuts to select / prepare / class settings, and the 3-step how-to.
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

  const steps = [
    { icon: BookOpen, title: t("lesson.selectLesson"), description: t("lesson.selectLessonStepDescription") },
    { icon: QrCode, title: t("lesson.shareClassLink"), description: t("lesson.shareClassLinkDescription") },
    { icon: Play, title: t("lesson.teach"), description: t("lesson.teachDescription") },
  ];

  return (
    <LessonContent width="default">
      <PageHeader
        title={cls?.name ?? t("lesson.manageTitle")}
        description={t("lesson.preflow.hub.description")}
        meta={cls?.bookTitle ? <Chip icon={BookOpen}>{cls.bookTitle}</Chip> : null}
      />

      <Suspense fallback={<NextLessonSkeleton />}>
        <NextLesson classId={classId} />
      </Suspense>

      <Section title={t("lesson.preflow.hub.quickActions")}>
        <Grid cols={3}>
          {actions.map((action) => (
            <Surface key={action.href} href={action.href} padding="md" className="flex items-start gap-3">
              <IconTile icon={action.icon} tone={action.tone} />
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-semibold text-fg">{action.title}</span>
                <span className="mt-0.5 block text-[0.8125rem] text-fg-muted">{action.description}</span>
              </span>
            </Surface>
          ))}
        </Grid>
      </Section>

      <Section title={t("lesson.preflow.hub.howTitle")}>
        <Surface padding="none">
          <ol className="grid divide-y divide-hairline md:grid-cols-3 md:divide-x md:divide-y-0">
            {steps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3 p-4">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-fg tabular"
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                    <step.icon aria-hidden="true" className="size-4 text-fg-muted" />
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-[0.8125rem] text-fg-muted">{step.description}</span>
                </span>
              </li>
            ))}
          </ol>
        </Surface>
      </Section>
    </LessonContent>
  );
}

async function NextLesson({ classId }: { classId: string }) {
  let articles: LessonArticle[];
  try {
    articles = await getLessonArticles(classId);
  } catch (error) {
    console.error("[lesson/hub] failed to load class articles", error);
    return (
      <Surface padding="none">
        <ArticlesLoadError compact />
      </Surface>
    );
  }

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={t("lesson.preflow.hub.noArticlesTitle")}
        description={t("lesson.preflow.hub.noArticlesBody")}
        action={
          <Button variant="outline" render={<Link href={`/dashboard/classes/${classId}`} />} nativeButton={false}>
            {t("lesson.preflow.hub.openClass")}
          </Button>
        }
      />
    );
  }

  const progress = getLessonProgress(articles);
  const next = getNextArticle(articles);
  const progressRow = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-4">
      <ProgressBar value={progress.percent} label={t("lesson.preflow.completed")} className="min-w-40 flex-1" />
      <span className="text-[0.8125rem] text-fg-muted tabular">
        {fill(t("lesson.preflow.chaptersProgress"), { done: progress.done, total: progress.total })}
      </span>
    </div>
  );

  if (!next) {
    return (
      <Surface padding="lg" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <IconTile icon={ClipboardCheck} tone="brand" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-fg">{t("lesson.preflow.hub.allDoneTitle")}</h2>
            <p className="mt-0.5 text-sm text-fg-muted">{t("lesson.preflow.hub.allDoneBody")}</p>
          </div>
          <Button render={<Link href={`/lesson/${classId}/select`} />} nativeButton={false} className="max-sm:hidden">
            {t("lesson.preflow.hub.selectTitle")}
          </Button>
        </div>
        {progressRow}
      </Surface>
    );
  }

  const chapter = fill(t("lesson.preflow.chapter"), { n: next.articleNumber });
  return (
    <Surface as="section" padding="lg" aria-labelledby="next-lesson-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <LessonCover
          src={next.imageUrl}
          alt={fill(t("lesson.preflow.coverAlt"), { title: next.title })}
          seed={next.articleNumber}
          eager
          className="aspect-[16/6] w-full shrink-0 rounded-lg sm:aspect-auto sm:min-h-36 sm:w-48 md:w-56"
          iconClassName="size-10"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[0.8125rem] font-medium text-brand-fg">
            {t("lesson.preflow.hub.nextTitle")} · {chapter}
          </p>
          <h2 id="next-lesson-title" className="mt-1 text-lg font-semibold text-fg md:text-xl">
            {next.title}
          </h2>
          {next.summary ? <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{next.summary}</p> : null}
          {next.cefrLevel ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip>{fill(t("lesson.preflow.cefr"), { level: next.cefrLevel })}</Chip>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-auto sm:pt-4">
            <Button
              size="lg"
              render={<Link href={lessonStartHref(classId, next.id, null)} />}
              nativeButton={false}
              className="max-sm:flex-1"
            >
              <Play aria-hidden="true" />
              {t("lesson.preflow.hub.startThis")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link href={`/lesson/${classId}/prepare?articleId=${encodeURIComponent(next.id)}`} />}
              nativeButton={false}
              className="max-sm:flex-1"
            >
              <GraduationCap aria-hidden="true" />
              {t("lesson.preflow.hub.rehearseThis")}
            </Button>
          </div>
        </div>
      </div>
      {progressRow}
    </Surface>
  );
}

function NextLessonSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Skeleton className="aspect-[16/6] w-full rounded-lg sm:aspect-auto sm:h-36 sm:w-48 md:w-56" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <div className="mt-auto flex gap-2 pt-4">
            <Skeleton className="h-10 w-36 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}
