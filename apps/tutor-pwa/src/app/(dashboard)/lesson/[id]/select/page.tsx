import { LessonContent } from "@/components/app/LessonShell";
import { PageHeader } from "@/components/app/Page";
import { ProgressBar } from "@/components/app/Atoms";
import { t } from "@/lib/i18n";
import { ArticlesLoadError } from "../_components/ArticlesLoadError";
import { fill, getLessonProgress, getNextArticle, parsePreparationMode, type LessonArticle } from "../_lib/articles";
import { getLessonArticles } from "../_lib/server";
import { SelectLessonClient } from "./SelectLessonClient";

export default async function SelectLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prepare?: string; mode?: string }>;
}) {
  const [{ id: classId }, query] = await Promise.all([params, searchParams]);
  const preparationMode = query.prepare === "1" ? parsePreparationMode(query.mode) : null;

  const title = preparationMode ? t("lesson.preflow.select.prepareTitle") : t("lesson.select.title");
  const description = preparationMode
    ? preparationMode === "guided"
      ? t("lesson.preflow.select.prepareGuidedSubtitle")
      : t("lesson.preflow.select.prepareExploreSubtitle")
    : t("lesson.select.subtitle");

  let articles: LessonArticle[];
  try {
    articles = await getLessonArticles(classId);
  } catch (error) {
    console.error("[lesson/select] failed to load class articles", error);
    return (
      <LessonContent width="wide">
        <PageHeader title={title} description={description} />
        <ArticlesLoadError />
      </LessonContent>
    );
  }

  const progress = getLessonProgress(articles);
  const header = (
    <PageHeader
      title={title}
      description={description}
      meta={
        progress.total > 0 ? (
          <div className="flex w-full max-w-xs items-center gap-3">
            <ProgressBar value={progress.percent} size="sm" label={t("lesson.preflow.completed")} className="flex-1" />
            <span className="shrink-0 text-[0.8125rem] text-fg-muted tabular">
              {fill(t("lesson.preflow.chaptersProgress"), { done: progress.done, total: progress.total })}
            </span>
          </div>
        ) : null
      }
    />
  );

  return (
    <SelectLessonClient
      classId={classId}
      articles={articles}
      nextArticleId={getNextArticle(articles)?.id ?? null}
      preparationMode={preparationMode}
      header={header}
    />
  );
}
