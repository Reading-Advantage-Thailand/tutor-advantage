"use client";

import Link from "next/link";
import { BookOpen, BookOpenCheck, Bot, Check, Gamepad2, Hourglass, Square, Star, Volume2, X } from "lucide-react";
import { AiRichText } from "@/components/lesson/AiRichText";
import { formatPhaseStep, getPhaseMeta } from "@/components/lesson/phaseMeta";
import { AppBar, Chip, IconTile, ListGroup, ListRow, Notice, Screen, SectionHeader } from "@/components/mobile";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatThaiDate, formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  countCorrect,
  getMcqOptions,
  getReviewAnswers,
  getReviewGameRow,
  getReviewNeutralRow,
  getWordAudio,
  getWordText,
  getWordThai,
  isMcq,
  optionLetter,
  type ArticleWord,
  type MCQ,
  type SAQ,
  type SessionAnswer,
} from "./readerModel";
import type { useReadAloud } from "./useReadAloud";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export interface ArticleData {
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

export interface SessionData {
  sessionId: string;
  score: number;
  finishedAt: string;
  answers: SessionAnswer[];
}

export interface PageData {
  article: ArticleData;
  mode: "pre-class" | "review";
  session: SessionData | null;
}

export const FALLBACK_HREF = "/progress";
const latinText = "[font-family:var(--font-latin)]";
const card = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";

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
              <Chip tone="sun" size="md" icon={Star} iconFilled>
                <span className="font-sans tabular-nums">{session.score}</span> {t("articleReader.scoreSuffix")}
              </Chip>
              {total > 0 ? (
                <span className="text-[13px] leading-[1.6] text-fg tabular-nums">
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
            leading={<IconTile icon={canSpeak ? Volume2 : BookOpenCheck} tone={canSpeak ? "blue" : "brand"} size="sm" />}
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
      <p className="mb-3 text-sm leading-[1.6] text-fg-muted">{t("articleReader.thinkFirstHint")}</p>
      <div className="flex flex-col gap-3">
        {all.map((q, i) => (
          <article key={q.id ?? i} className={cn(card, "px-[18px] pt-3.5 pb-4")}>
            <Chip tone="info" size="sm">
              {t("articleReader.questionPrefix")} {i + 1}
            </Chip>
            <p lang="en" className={cn("mt-2 text-[17px] leading-[1.6] font-semibold text-fg", latinText)}>{q.question}</p>
            {isMcq(q) ? (
              <ol className="mt-3 flex flex-col gap-2">
                {getMcqOptions(q).map((opt, oi) => (
                  <li key={oi} className="flex items-start gap-3 rounded-lg bg-surface-muted px-3 py-2.5 text-[15px] leading-[1.6] text-fg">
                    <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-[13px] leading-none font-semibold text-fg-muted">
                      {optionLetter(oi)}
                    </span>
                    <span lang="en" className={cn("min-w-0 break-words", latinText)}>{opt}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </article>
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
          const game = getReviewGameRow(a);
          if (game) {
            return (
              <article key={i} className={cn(card, "px-[18px] pt-3.5 pb-4")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] leading-[1.5] font-semibold text-fg-muted">
                    {formatPhaseStep(a.phase)} · {getPhaseMeta(a.phase).label}
                  </p>
                  <Chip tone="brand" size="sm" className="tabular-nums">+{a.score}</Chip>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <IconTile icon={Gamepad2} tone={getPhaseMeta(a.phase).tone} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs leading-[1.5] font-medium text-fg-muted">{t("gameResult.label")}</p>
                    <p lang="en" className={cn("text-base leading-[1.5] font-semibold break-words text-fg", latinText)}>{game.name}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-[1.6] font-semibold text-fg-muted tabular-nums">{game.scoreText}</p>
              </article>
            );
          }
          const tone = a.isCorrect === true ? "success" : "neutral";
          // Step 15 (question to AI) / step 16 (reflection): no right answer.
          const neutral = getReviewNeutralRow(a);
          if (neutral) {
            return (
              <article key={i} className={cn(card, "px-[18px] pt-3.5 pb-4")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] leading-[1.5] font-semibold text-fg-muted">
                    {formatPhaseStep(a.phase)} · {getPhaseMeta(a.phase).label}
                  </p>
                  <Chip tone={tone === "success" ? "brand" : "neutral"} size="sm" className="shrink-0 tabular-nums">+{a.score}</Chip>
                </div>
                <p className="mt-1.5 text-base leading-[1.6] font-semibold break-words text-fg [overflow-wrap:anywhere]">{neutral.title}</p>
                <p className="mt-2.5 max-w-full min-w-0 rounded-lg border-[1.5px] border-clay-rim bg-surface-muted px-3.5 py-2 text-sm leading-[1.6] break-words text-fg [overflow-wrap:anywhere]">
                  <span className="font-semibold">{neutral.answerLabel}:</span>{" "}
                  <span className={neutral.answered ? undefined : "text-fg-muted"}>{neutral.answerText}</span>
                </p>
                {a.aiFeedback ? (
                  <div className="mt-2.5 flex items-start gap-2.5 rounded-lg border-[1.5px] border-info-border bg-info-bg px-3.5 py-3">
                    <Bot aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info-fg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-[1.6] font-semibold text-info-fg">{neutral.aiLabel}</p>
                      <AiRichText text={a.aiFeedback} className="mt-0.5 min-w-0 text-sm leading-[1.6] text-fg" />
                    </div>
                  </div>
                ) : null}
              </article>
            );
          }
          return (
            <article key={i} className={cn(card, "px-[18px] pt-3.5 pb-4")}>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[13px] leading-[1.5] font-semibold text-fg-muted">
                  {formatPhaseStep(a.phase)} · {getPhaseMeta(a.phase).label}
                </p>
                <span className="flex shrink-0 items-center gap-1.5">
                  {/* Status = icon + word; a wrong answer is neutral, never red. */}
                  {a.isCorrect === true ? (
                    <Chip tone="success" size="sm" icon={Check}>{t("lessonHistory.correctLabel")}</Chip>
                  ) : a.isCorrect === false ? (
                    <Chip tone="neutral" size="sm" icon={X}>{t("lessonHistory.incorrectLabel")}</Chip>
                  ) : null}
                  <Chip tone={tone === "success" ? "brand" : "neutral"} size="sm" className="tabular-nums">+{a.score}</Chip>
                </span>
              </div>
              <p lang="en" className={cn("mt-1.5 text-base leading-[1.6] font-semibold break-words text-fg [overflow-wrap:anywhere]", latinText)}>{a.questionText}</p>
              <div className="mt-2.5 flex flex-col gap-2">
                <p
                  className={cn(
                    "max-w-full min-w-0 rounded-lg border-[1.5px] px-3.5 py-2 text-sm leading-[1.6] break-words [overflow-wrap:anywhere]",
                    a.isCorrect === false ? "border-clay-rim bg-surface-muted text-fg" : "border-success-border bg-success-bg text-success-fg",
                  )}
                >
                  <span className="font-semibold">{t("articleReader.answerPrefix")}:</span> <span lang="en">{a.answerText || "—"}</span>
                </p>
                {a.isCorrect === false && a.correctAnswer ? (
                  <p className="max-w-full min-w-0 rounded-lg border-[1.5px] border-success-border bg-success-bg px-3.5 py-2 text-sm leading-[1.6] break-words text-success-fg [overflow-wrap:anywhere]">
                    <span className="font-semibold">{t("articleReader.solutionPrefix")}:</span> <span lang="en">{a.correctAnswer}</span>
                  </p>
                ) : null}
              </div>
              {a.aiFeedback ? (
                <div className="mt-2.5 flex items-start gap-2.5 rounded-lg border-[1.5px] border-info-border bg-info-bg px-3.5 py-3">
                  <Bot aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info-fg" />
                  <AiRichText text={a.aiFeedback} className="min-w-0 text-sm leading-[1.6] text-fg" />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Loaded article ─────────────────────────────────────────────────────────── */

/**
 * The reader once the article has loaded (moved verbatim from page.tsx so
 * /dev/lesson-preview can render it from fixtures): hero card, mode notice,
 * passage, vocabulary, questions or scored answers, and the next step.
 */
export function ArticleReaderView({ data, paragraphs, speechSupported, readAloud }: {
  data: PageData;
  paragraphs: string[];
  speechSupported: boolean;
  readAloud: Pick<ReturnType<typeof useReadAloud>, "readingIndex" | "isReading" | "startReading" | "stopReading" | "speakWord">;
}) {
  const article = data.article;
  const { readingIndex, isReading, startReading, stopReading, speakWord } = readAloud;
  const { mode, session } = data;
  const words = article.words ?? [];
  const mcqs = article.multipleChoiceQuestions ?? [];
  const saqs = article.shortAnswerQuestions ?? [];
  const levels = [article.cefr_level, article.ra_level].filter(Boolean).join(" · ");
  const canListen = speechSupported && paragraphs.length > 0;

  return (
    <Screen>
      <AppBar title={article.title ?? t("articleReader.articleTitle")} subtitle={levels || undefined} back fallbackHref={FALLBACK_HREF} />

      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 pt-3 pb-10">
        {/* Article: hero card (mode, levels, title, listen) + the passage */}
        <article aria-labelledby="article-title" className="flex flex-col gap-3.5">
          <header className={cn(card, "px-[18px] pt-4 pb-[18px]")}>
            <div className="flex items-start gap-3.5">
              <IconTile icon={BookOpen} tone={mode === "review" ? "brand" : "amber"} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={mode === "review" ? "success" : "warning"} size="sm" dot>
                    {mode === "review" ? t("articleReader.reviewChip") : t("articleReader.preClassChip")}
                  </Chip>
                </div>
                <h2 id="article-title" lang="en" className="mt-1.5 font-heading text-[24px] leading-[1.3] font-bold text-balance break-words text-fg">
                  {article.title}
                </h2>
              </div>
            </div>
            {canListen ? (
              <Button
                variant={isReading ? "brand" : "brandSoft"}
                size="touch"
                className="mt-4 w-full"
                aria-pressed={isReading}
                onClick={() => (isReading ? stopReading() : startReading(0))}
              >
                {isReading ? <Square aria-hidden="true" fill="currentColor" /> : <Volume2 aria-hidden="true" />}
                {isReading ? t("articleReader.stopListening") : t("articleReader.listen")}
              </Button>
            ) : null}
          </header>

          <ModeBanner mode={mode} session={session} />

          <div lang="en" className={cn(card, "flex flex-col gap-4 px-[18px] py-5 text-[17px] leading-[1.7] text-fg", latinText)}>
            {paragraphs.map((para, i) => (
              <p
                key={i}
                aria-current={readingIndex === i ? "true" : undefined}
                className={cn("-mx-2 max-w-[65ch] rounded-xl px-2 transition-colors", readingIndex === i && "bg-brand-soft text-brand-soft-fg")}
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
          <section className={cn(card, "flex flex-col gap-4 px-[18px] pt-4 pb-[18px]")}>
            <div className="flex items-center gap-3.5">
              <IconTile icon={Hourglass} tone="amber" size="lg" />
              <div className="min-w-0">
                <h2 className="font-heading text-lg leading-[1.4] font-semibold text-fg">{t("articleReader.waitClassTitle")}</h2>
                <p className="mt-0.5 text-sm leading-[1.6] text-fg-muted">{t("articleReader.waitClassDescription")}</p>
              </div>
            </div>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
              {t("articleReader.backHome")}
            </Link>
          </section>
        ) : (
          <Link href="/progress" className={cn(buttonVariants({ variant: "brand", size: "cta-lg" }), "w-full")}>
            {t("articleReader.progressCta")}
          </Link>
        )}
      </div>
    </Screen>
  );
}
