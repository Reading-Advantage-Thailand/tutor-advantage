"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpenCheck } from "lucide-react";
import { useLiff } from "@/components/providers/LiffProvider";
import { AppBar, ErrorState, Screen, StatusScreen } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArticleReaderView, FALLBACK_HREF, type PageData } from "./_components/ArticleReaderView";
import { ReaderSkeleton } from "./_components/ReaderSkeleton";
import { getParagraphs } from "./_components/readerModel";
import { useReadAloud, useSpeechSupported } from "./_components/useReadAloud";

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function ArticleReaderPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const { isReady, profile, error: liffError, errorCode, retry } = useLiff();
  // A 401 right after LIFF start-up is retried once by useCachedResource after
  // the session cookie is confirmed, so no extra session probe is needed first.
  const { data, error, isLoading, isValidating, refetch } = useCachedResource<PageData>(
    profile && articleId ? `${profile.userId}:article:${articleId}` : null,
    () => studentApi.getStudentArticle(articleId) as Promise<PageData>,
    { enabled: isReady },
  );
  const article = data?.article;
  const paragraphs = useMemo(() => (article ? getParagraphs(article) : []), [article]);
  const speechSupported = useSpeechSupported();
  const { readingIndex, isReading, startReading, stopReading, speakWord } = useReadAloud(paragraphs);

  if (!isReady || isLoading) return <ReaderSkeleton />;

  const backAppBar = <AppBar title={t("articleReader.articleTitle")} back fallbackHref={FALLBACK_HREF} />;

  if (liffError || !profile) {
    return (
      <Screen>
        {backAppBar}
        <ErrorState kind={errorCode === "network" ? "offline" : "error"} onRetry={retry} className="flex-1 justify-center" />
      </Screen>
    );
  }

  if (!data || !article) {
    const status = (error as { status?: unknown } | null)?.status;
    const notFound = !error || status === 404 || status === 403;
    return (
      <Screen>
        {backAppBar}
        {notFound ? (
          <StatusScreen
            icon={BookOpenCheck}
            tone="neutral"
            title={t("articleReader.notFoundTitle")}
            description={t("articleReader.notFoundDescription")}
            primaryAction={
              <Link href={FALLBACK_HREF} className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
                {t("articleReader.progressCta")}
              </Link>
            }
          />
        ) : (
          <ErrorState
            title={t("articleReader.loadErrorTitle")}
            description={t("articleReader.loadErrorDescription")}
            onRetry={() => void refetch()}
            retrying={isValidating}
            className="flex-1 justify-center"
          />
        )}
      </Screen>
    );
  }

  return (
    <ArticleReaderView
      data={data}
      paragraphs={paragraphs}
      speechSupported={speechSupported}
      readAloud={{ readingIndex, isReading, startReading, stopReading, speakWord }}
    />
  );
}
