import Link from "next/link";
import { AlertCircle, ArrowLeft, BookOpen } from "lucide-react";
import { EmptyState } from "@/components/app/Feedback";
import { LessonContent } from "@/components/app/LessonShell";
import { ShellTitle } from "@/components/app/ShellContext";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { parsePreparationMode } from "../../_lib/articles";
import { resolveArticleCovers } from "../../_lib/server";
import { getPreparationArticle } from "../actions";
import PrepareLessonClient, { type PreparationArticle } from "./PrepareLessonClient";

export default async function PreparationLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ articleId?: string; mode?: string }>;
}) {
  const [{ id: classId }, { articleId, mode }] = await Promise.all([params, searchParams]);
  const preparationMode = parsePreparationMode(mode);

  if (!articleId) {
    return (
      <LessonContent width="narrow" className="flex-1 justify-center">
        <ShellTitle title={t("lesson.preflow.prepare.title")} />
        <EmptyState
          icon={BookOpen}
          tone="amber"
          title={t("lesson.preflow.rehearsal.noArticleTitle")}
          description={t("lesson.preflow.rehearsal.noArticleBody")}
          action={
            <Button render={<Link href={`/lesson/${classId}/prepare`} />} nativeButton={false}>
              <ArrowLeft aria-hidden="true" />
              {t("lesson.preflow.rehearsal.backToModes")}
            </Button>
          }
        />
      </LessonContent>
    );
  }

  let article: Record<string, unknown>;
  try {
    article = await getPreparationArticle(classId, articleId);
  } catch (error) {
    // Show our own (Thai) messages; hide raw technical errors behind a generic hint.
    const raw = error instanceof Error ? error.message : "";
    const message = /[\u0E00-\u0E7F]/.test(raw) ? raw : t("lesson.preflow.articlesLoadFailedBody");
    return (
      <LessonContent width="narrow" className="flex-1 justify-center">
        <ShellTitle title={t("lesson.preflow.prepare.title")} />
        <EmptyState
          icon={AlertCircle}
          tone="red"
          title={t("lesson.preflow.rehearsal.loadFailedTitle")}
          description={message}
          action={
            <Button
              variant="outline"
              render={<Link href={`/lesson/${classId}/select?prepare=1&mode=${preparationMode}`} />}
              nativeButton={false}
            >
              <ArrowLeft aria-hidden="true" />
              {t("lesson.preflow.rehearsal.backToSelect")}
            </Button>
          }
        />
      </LessonContent>
    );
  }

  // Resolve the cover on the server so the stage never shows a broken image.
  const imageUrls = await resolveArticleCovers(article);

  return (
    <PrepareLessonClient
      classId={classId}
      article={{ ...article, image_urls: imageUrls } as unknown as PreparationArticle}
      mode={preparationMode}
    />
  );
}
