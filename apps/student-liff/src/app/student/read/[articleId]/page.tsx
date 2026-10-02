"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpenCheck, Bot, Hourglass, Square, Star, Volume2 } from "lucide-react";
import { useLiff } from "@/components/providers/LiffProvider";
import { formatPhaseStep, getPhaseMeta } from "@/components/lesson/phaseMeta";
import {
  AppBar,
  Chip,
  ErrorState,
  IconTile,
  ListGroup,
  ListRow,
  Notice,
  Screen,
  SectionHeader,
  StatusScreen,
  Surface,
} from "@/components/mobile";
import { Button, buttonVariants } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatThaiDate, formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ReaderSkeleton } from "./_components/ReaderSkeleton";
import {
  countCorrect,
  getMcqOptions,
  getParagraphs,
  getReviewAnswers,
  getWordAudio,
  getWordText,
  getWordThai,
  isMcq,
  optionLetter,
  type ArticleWord,
  type MCQ,
  type SAQ,
  type SessionAnswer,
} from "./_components/readerModel";
import { useReadAloud, useSpeechSupported } from "./_components/useReadAloud";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface ArticleData {
  id?: string;
  title?: string;
  passage?: string;
  summary?: string;
  cefr_level?: string;
  ra_level?: string;
  words?: ArticleWord[];
  sentences?: (string | { sentences: string })[];
  multipleChoiceQuestions?: MCQ[];
  shortAnswerQuestions?: SAQ[];
}

interface SessionData {
  sessionId: string;
  score: number;
  finishedAt: string;
  answers: SessionAnswer[];
}

interface PageData {
  article: ArticleData;
  mode: "pre-class" | "review";
  session: SessionData | null;
}

const FALLBACK_HREF = "/progress";
const latinText = "[font-family:var(--font-latin)]";

/* ─── Sections ───────────────────────────────────────────────────────────────── */

function ModeBanner({ mode, session }: { mode: "pre-class" | "review"; session: SessionData | null }) {
  if (mode === "pre-class") {
    return (
      <Notice
        tone="warning"
        icon={BookOpenCheck}
        title={t("articleReader.preClassTitle")}
        description={t("articleReader.preClassDescription")}
      />
    );
  }

  const { correct, total } = countCorrect(session?.answers);
  const finishedAt = session ? `${formatThaiDate(session.finishedAt, "medium")} ${formatThaiTime(session.finishedAt, { suffix: true })}` : "";

  return (
    <Notice
      tone="success"
      title={t("articleReader.reviewTitle")}
      description={
        <>
          <p>{t("articleReader.reviewDescriptionPrefix")} {finishedAt}</p>
          {session ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone="success" size="sm" icon={Star}>
                {session.score} {t("articleReader.scoreSuffix")}
              </Chip>
              {total > 0 ? (
                <span className="text-[13px] leading-[1.5] text-fg-muted">
                  {t("articleReader.correctCountPrefix")} {correct}/{total} {t("articleReader.correctCountSuffix")}
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      }
    />
  );
}

function VocabularySection({ words, canSpeak, onSpeak }: {
  words: ArticleWord[];
  canSpeak: boolean;
  onSpeak: (word: string, audioUrl?: string) => void;
}) {
  const items = words.filter((w) => getWordText(w));
  if (!items.length) return null;
  return (
    <ListGroup header={t("articleReader.vocabularyTitle")}>
      {items.map((w, idx) => {
        const wordText = getWordText(w);
        const thai = getWordThai(w);
        return (
          <ListRow
            key={`${wordText}-${idx}`}
            onClick={canSpeak ? () => onSpeak(wordText, getWordAudio(w)) : undefined}
            leading={<IconTile icon={canSpeak ? Volume2 : BookOpenCheck} tone="brand" size="md" />}
            title={<span lang="en" className={latinText}>{wordText}</span>}
            subtitle={thai || undefined}
            trailing={canSpeak ? <span className="sr-only">{t("articleReader.listenWord")} {wordText}</span> : undefined}
          />
        );
      })}
    </ListGroup>
  );
}

/** Pre-class questions to think about. Answers are not revealed here: they are asked (and scored) in class. */
function PreClassQuestions({ mcqs, saqs }: { mcqs: MCQ[]; saqs: SAQ[] }) {
  const all: (MCQ | SAQ)[] = [...mcqs, ...saqs];
  if (!all.length) return null;
  return (
    <section>
      <SectionHeader title={t("articleReader.comprehensionTitle")} count={all.length} />
      <p className="mb-3 text-[13px] leading-[1.6] text-fg-muted">{t("articleReader.thinkFirstHint")}</p>
      <div className="flex flex-col gap-3">
        {all.map((q, i) => (
          <Surface key={q.id ?? i} as="article">
            <p className="text-[13px] leading-[1.5] font-semibold text-info-fg">
              {t("articleReader.questionPrefix")} {i + 1}
            </p>
            <p lang="en" className={cn("mt-1 text-[17px] leading-[1.6] font-semibold text-fg", latinText)}>{q.question}</p>
            {isMcq(q) ? (
              <ol className="mt-3 flex flex-col gap-2">
                {getMcqOptions(q).map((opt, oi) => (
                  <li key={oi} className="flex items-start gap-2.5 text-[15px] leading-[1.6] text-fg-muted">
                    <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fill-muted text-xs font-bold text-fg-muted">
                      {optionLetter(oi)}
                    </span>
                    <span lang="en" className={latinText}>{opt}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </Surface>
        ))}
      </div>
    </section>
  );
}

function ReviewAnswers({ answers }: { answers: SessionAnswer[] }) {
  const interactive = getReviewAnswers(answers);
  if (!interactive.length) return null;
  return (
    <section>
      <SectionHeader title={t("articleReader.reviewAnswersTitle")} count={interactive.length} className="mb-1" />
      <div className="flex flex-col gap-3">
        {interactive.map((a, i) => {
          const tone = a.isCorrect === true ? "success" : a.isCorrect === false ? "danger" : "neutral";
          return (
            <Surface key={i} as="article">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[13px] leading-[1.5] font-semibold text-fg-muted">
                  {formatPhaseStep(a.phase)} · {getPhaseMeta(a.phase).label}
                </p>
                <Chip tone={tone} size="sm" className="tabular-nums">+{a.score}</Chip>
              </div>
              <p lang="en" className={cn("mt-1.5 text-base leading-[1.6] font-semibold text-fg", latinText)}>{a.questionText}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-sm leading-[1.5] font-semibold",
                    a.isCorrect === false ? "border-danger-border bg-danger-bg text-danger-fg" : "border-success-border bg-success-bg text-success-fg",
                  )}
                >
                  {t("articleReader.answerPrefix")}: <span lang="en">{a.answerText || "—"}</span>
                </span>
                {a.isCorrect === false && a.correctAnswer ? (
                  <span className="rounded-xl border border-success-border bg-success-bg px-3 py-1.5 text-sm leading-[1.5] font-semibold text-success-fg">
                    {t("articleReader.solutionPrefix")}: <span lang="en">{a.correctAnswer}</span>
                  </span>
                ) : null}
              </div>
              {a.aiFeedback ? (
                <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-info-border bg-info-bg p-3">
                  <Bot aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info-fg" />
                  <p className="text-sm leading-[1.6] whitespace-pre-line text-fg">{a.aiFeedback}</p>
                </div>
              ) : null}
            </Surface>
          );
        })}
      </div>
    </section>
  );
}

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

  const { mode, session } = data;
  const words = article.words ?? [];
  const mcqs = article.multipleChoiceQuestions ?? [];
  const saqs = article.shortAnswerQuestions ?? [];
  const levels = [article.cefr_level, article.ra_level].filter(Boolean).join(" · ");
  const canListen = speechSupported && paragraphs.length > 0;

  return (
    <Screen>
      <AppBar
        title={article.title ?? t("articleReader.articleTitle")}
        subtitle={levels || undefined}
        back
        fallbackHref={FALLBACK_HREF}
        actions={
          <Chip tone={mode === "review" ? "success" : "warning"} size="sm" className="mr-3">
            {mode === "review" ? t("articleReader.reviewChip") : t("articleReader.preClassChip")}
          </Chip>
        }
      />

      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6 px-4 pt-3 pb-10">
        <ModeBanner mode={mode} session={session} />

        {/* Article body */}
        <article aria-labelledby="article-title">
          <h2 id="article-title" lang="en" className={cn("text-2xl leading-[1.35] font-extrabold text-fg", latinText)}>
            {article.title}
          </h2>
          {canListen ? (
            <Button
              variant={isReading ? "brand" : "brandSoft"}
              size="touch"
              className="mt-3"
              aria-pressed={isReading}
              onClick={() => (isReading ? stopReading() : startReading(0))}
            >
              {isReading ? <Square aria-hidden="true" fill="currentColor" /> : <Volume2 aria-hidden="true" />}
              {isReading ? t("articleReader.stopListening") : t("articleReader.listen")}
            </Button>
          ) : null}
          <div lang="en" className={cn("mt-4 flex max-w-[65ch] flex-col gap-4 text-[18px] leading-[1.8] text-fg", latinText)}>
            {paragraphs.map((para, i) => (
              <p
                key={i}
                aria-current={readingIndex === i ? "true" : undefined}
                className={cn("-mx-2 rounded-xl px-2 transition-colors", readingIndex === i && "bg-brand-soft")}
              >
                {para}
              </p>
            ))}
          </div>
        </article>

        <VocabularySection words={words} canSpeak={speechSupported} onSpeak={speakWord} />

        {/* Pre-class: questions to think about */}
        {mode === "pre-class" && <PreClassQuestions mcqs={mcqs} saqs={saqs} />}

        {/* Review: scored answers */}
        {mode === "review" && session && <ReviewAnswers answers={session.answers} />}

        {/* Next step */}
        {mode === "pre-class" ? (
          <Surface className="flex flex-col items-center gap-2 py-6 text-center">
            <IconTile icon={Hourglass} tone="amber" size="lg" shape="circle" />
            <h2 className="mt-1 text-[17px] leading-[1.45] font-bold text-fg">{t("articleReader.waitClassTitle")}</h2>
            <p className="max-w-[300px] text-sm leading-[1.6] text-fg-muted">{t("articleReader.waitClassDescription")}</p>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "brand", size: "touch" }), "mt-3")}>
              {t("articleReader.backHome")}
            </Link>
          </Surface>
        ) : (
          <Link href="/progress" className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
            {t("articleReader.progressCta")}
          </Link>
        )}
      </div>
    </Screen>
  );
}
