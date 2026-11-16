"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, CheckCircle2, Gamepad2, Lightbulb, MessageSquareText, SearchX, Star, XCircle } from "lucide-react";
import { useLiff } from "@/components/providers/LiffProvider";
import { AiRichText } from "@/components/lesson/AiRichText";
import { AnswerMiniTile, isAnswerLetter } from "@/components/lesson/AnswerTiles";
import { formatPhaseStep, getPhaseMeta } from "@/components/lesson/phaseMeta";
import { RankBadge } from "@/components/lesson/RankBadge";
import { formatRankOf, getRankMeta } from "@/components/lesson/rankMeta";
import { AppBar, Chip, EmptyState, ErrorState, Screen, SectionHeader, StatusScreen, Surface } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { HeroOverlap, ToneHero } from "@/components/mobile/Hero";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DetailSkeleton } from "./_components/DetailSkeleton";
import { getDetailGameRow, getNeutralRowView, isNotFoundError, parseAnswerChoice, type NeutralRowView } from "./_components/detailModel";

interface Answer {
  phase: number;
  score: number;
  question: string;
  answer: string;
  isCorrect: boolean | null;
  correctAnswer?: string;
  aiFeedback?: string;
  /** "game" for live-lesson game results (newer API responses). */
  kind?: string;
}

/** Card header: phase step · name, and the points this answer earned. */
function AnswerHeader({ phaseLabel, score, scored }: { phaseLabel: string; score: number; scored: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b-[1.5px] border-hairline px-4 py-2.5">
      <p className="min-w-0 truncate text-sm leading-[1.6] font-medium text-fg-muted">{phaseLabel}</p>
      <Chip tone={scored ? "success" : "neutral"} size="sm" className="tabular-nums">
        +{score} {t("lessonHistory.pointsUnit")}
      </Chip>
    </div>
  );
}

/** Live-lesson game result: game name and score, no correct/incorrect verdict. */
function GameAnswerCard({ phaseLabel, score, name, scoreText }: { phaseLabel: string; score: number; name: string; scoreText: string }) {
  return (
    <Surface as="article" padding="none" className="overflow-hidden">
      <AnswerHeader phaseLabel={phaseLabel} score={score} scored={score > 0} />
      <div className="flex items-start gap-3.5 p-4">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-tile)] bg-tile-blue text-icon-blue">
          <Gamepad2 className="size-6" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-[1.6] font-semibold text-fg-muted">{t("gameResult.label")}</p>
          <p lang="en" className="mt-0.5 text-base leading-[1.5] font-semibold break-words text-fg">{name}</p>
          <p className="mt-0.5 text-[15px] leading-[1.6] font-semibold text-fg-muted tabular-nums">{scoreText}</p>
        </div>
      </div>
    </Surface>
  );
}

interface Session {
  articleTitle: string;
  tutorName: string;
  date: string;
  totalScore: number;
  rank?: number;
  totalParticipants?: number;
}

interface LessonDetail {
  session: Session;
  answers: Answer[];
}

const HISTORY_HREF = "/lesson/history";

/**
 * One answer. Right and wrong are told by an icon and a word, never by colour
 * alone and never in red for a child's wrong answer (patterns.md S7): a right
 * answer sits in a success well, a wrong one in a neutral well. A multiple
 * choice answer repeats its option tile (colour + shape + letter), which says
 * nothing about right or wrong.
 */
function AnswerCard({ answer: a }: { answer: Answer }) {
  const phaseLabel = `${formatPhaseStep(a.phase)} · ${getPhaseMeta(a.phase).label}`;
  const game = getDetailGameRow(a);
  if (game) return <GameAnswerCard phaseLabel={phaseLabel} score={a.score} name={game.name} scoreText={game.scoreText} />;
  const neutral = getNeutralRowView(a);
  if (neutral) return <NeutralAnswerCard phaseLabel={phaseLabel} answer={a} view={neutral} />;

  const choice = parseAnswerChoice(a.answer);
  const scored = a.score > 0;

  return (
    <Surface as="article" padding="none" className="overflow-hidden">
      <AnswerHeader phaseLabel={phaseLabel} score={a.score} scored={scored} />

      <div className="flex flex-col gap-3 p-4">
        <p lang="en" className="text-[17px] leading-[1.6] font-semibold break-words text-fg [overflow-wrap:anywhere]">
          {a.question || t("lessonHistory.questionFallback")}
        </p>

        {/* Student answer */}
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border-[1.5px] p-3",
            a.isCorrect ? "border-success-border bg-success-bg" : "border-clay-rim bg-surface-muted",
          )}
        >
          {choice.label ? (
            isAnswerLetter(choice.label) ? (
              <AnswerMiniTile letter={choice.label} />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-tile-neutral font-heading text-[22px] font-bold text-icon-neutral"
              >
                {choice.label}
              </span>
            )
          ) : null}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm leading-[1.6] font-semibold",
                a.isCorrect ? "text-success-fg" : "text-fg-muted",
              )}
            >
              {a.isCorrect ? (
                <CheckCircle2 aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={2.4} />
              ) : (
                <XCircle aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={2.4} />
              )}
              {t("lessonHistory.yourAnswer")} · {a.isCorrect ? t("lessonHistory.correctLabel") : t("lessonHistory.incorrectLabel")}
            </p>
            <p className="mt-0.5 text-base leading-[1.6] font-semibold break-words text-fg [overflow-wrap:anywhere]">
              {choice.label ? <span className="sr-only">{choice.label}. </span> : null}
              {choice.text}
            </p>
          </div>
        </div>

        {/* Correct answer */}
        {!a.isCorrect && a.correctAnswer ? (
          <div className="flex items-start gap-3 rounded-lg border-[1.5px] border-success-border bg-success-bg p-3">
            <Lightbulb aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success-fg" />
            <div className="min-w-0">
              <p className="text-sm leading-[1.6] font-semibold text-success-fg">{t("lessonHistory.correctAnswer")}</p>
              <p lang="en" className="mt-0.5 text-base leading-[1.6] font-semibold break-words text-fg [overflow-wrap:anywhere]">{a.correctAnswer}</p>
            </div>
          </div>
        ) : null}

        <AiTextBox label={t("lessonHistory.aiFeedbackLabel")} text={a.aiFeedback} />
      </div>
    </Surface>
  );
}

/** AI feedback or answer, with the safe markdown subset (bold, lists, paragraphs). */
function AiTextBox({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border-[1.5px] border-info-border bg-info-bg p-3">
      <Bot aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info-fg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-[1.6] font-semibold text-info-fg">{label}</p>
        <AiRichText text={text} className="mt-0.5 text-base leading-[1.65] text-fg" />
      </div>
    </div>
  );
}

/**
 * Step 15 (language question to AI) and step 16 (reflection): no right answer,
 * so a Thai heading instead of the stored sentinel and a neutral well with no
 * verdict word or icon.
 */
function NeutralAnswerCard({ phaseLabel, answer: a, view }: { phaseLabel: string; answer: Answer; view: NeutralRowView }) {
  return (
    <Surface as="article" padding="none" className="overflow-hidden">
      <AnswerHeader phaseLabel={phaseLabel} score={a.score} scored={a.score > 0} />

      <div className="flex flex-col gap-3 p-4">
        <p className="text-[17px] leading-[1.6] font-semibold break-words text-fg [overflow-wrap:anywhere]">{view.title}</p>

        <div className="rounded-lg border-[1.5px] border-clay-rim bg-surface-muted p-3">
          <p className="text-sm leading-[1.6] font-semibold text-fg-muted">{view.answerLabel}</p>
          <p
            className={cn(
              "mt-0.5 text-base leading-[1.6] break-words [overflow-wrap:anywhere]",
              view.answered ? "font-semibold text-fg" : "text-fg-muted",
            )}
          >
            {view.answerText}
          </p>
        </div>

        <AiTextBox label={view.aiLabel} text={a.aiFeedback} />
      </div>
    </Surface>
  );
}

export default function LessonHistoryDetailPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { isReady, profile, error: liffError, errorCode, retry } = useLiff();
  const { data: detail, error, isLoading, isValidating, refetch } = useCachedResource<LessonDetail>(
    profile && sessionId ? `${profile.userId}:lessonHistory:${sessionId}` : null,
    () => studentApi.getLessonSessionDetails(sessionId),
    { enabled: isReady },
  );

  if (!isReady || isLoading) return <DetailSkeleton />;

  const appBar = <AppBar title={t("lessonHistory.summaryTitle")} back fallbackHref={HISTORY_HREF} />;
  const backToHistory = (
    <Link href={HISTORY_HREF} className={cn(buttonVariants({ variant: "ghost", size: "touch" }), "w-full text-fg-muted")}>
      {t("lessonHistory.backToHistory")}
    </Link>
  );

  if (liffError || !profile) {
    return (
      <Screen>
        {appBar}
        <div className="px-4 pt-3">
          <ErrorState card kind={errorCode === "network" ? "offline" : "error"} onRetry={retry} />
        </div>
      </Screen>
    );
  }

  if (!detail?.session) {
    return (
      <Screen>
        {appBar}
        {error && !isNotFoundError(error) ? (
          <div className="px-4 pt-3">
            <ErrorState
              card
              description={t("lessonHistory.detailLoadFailed")}
              onRetry={() => void refetch()}
              retrying={isValidating}
              secondaryAction={backToHistory}
            />
          </div>
        ) : (
          <StatusScreen
            icon={SearchX}
            tone="neutral"
            variant="notFound"
            title={t("lessonHistory.notFoundTitle")}
            description={t("lessonHistory.notFoundDescription")}
            primaryAction={
              <Link href={HISTORY_HREF} className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
                {t("lessonHistory.backToHistory")}
              </Link>
            }
          />
        )}
      </Screen>
    );
  }

  const { session } = detail;
  const answers = detail.answers ?? [];
  // Explicit > 0 checks: `{rank && …}` used to print a stray "0".
  const rankMeta = getRankMeta(session.rank);

  return (
    <Screen>
      <AppBar title={t("lessonHistory.summaryTitle")} back fallbackHref={HISTORY_HREF} variant="brand" />

      {/* Result hero (components.md §3.3): the lesson, the tutor and the day. */}
      <ToneHero aria-labelledby="history-lesson-title">
        <h2
          id="history-lesson-title"
          lang={session.articleTitle ? "en" : undefined}
          className="t-title-l text-balance break-words"
        >
          {session.articleTitle || t("lessonHistory.untitledLesson")}
        </h2>
        <p className="mt-1.5 text-[15px] leading-[1.6] text-hero-fg-muted">
          {t("lessonHistory.tutorPrefix")} {session.tutorName} · {formatThaiDate(session.date, "long")}
        </p>
      </ToneHero>

      <HeroOverlap className="pb-8">
        {/* The result: the view's one reward group (points + medal). Below
            360px each cell stacks its disc over the value, and the points unit
            wraps under a long number instead of running into the rank cell. */}
        <Surface padding="none" className="grid grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5 px-4 py-4">
            <p className="text-sm leading-[1.6] font-medium text-fg-muted">{t("lessonHistory.scoreStat")}</p>
            <div className="flex items-center gap-2.5 max-[359px]:flex-col max-[359px]:items-start max-[359px]:gap-2">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-solid text-on-accent shadow-[inset_0_0_0_1.5px_var(--accent-edge)]"
              >
                <Star className="size-5 fill-current" strokeWidth={1.5} />
              </span>
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-[28px] leading-[1.2] font-semibold text-fg tabular-nums">
                <span>{session.totalScore}</span>{" "}
                <span className="text-sm leading-[1.6] font-medium text-fg-muted">{t("lessonHistory.pointsUnit")}</span>
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 border-l-[1.5px] border-hairline px-4 py-4">
            <p className="text-sm leading-[1.6] font-medium text-fg-muted">{t("lessonHistory.rankLabel")}</p>
            <div className="flex items-center gap-2.5 max-[359px]:flex-col max-[359px]:items-start max-[359px]:gap-2">
              {rankMeta.hasRank ? <RankBadge rank={rankMeta.rank} size="md" /> : null}
              <p className="min-w-0 text-[28px] leading-[1.2] font-semibold text-fg tabular-nums">
                {rankMeta.hasRank ? formatRankOf(rankMeta.rank, session.totalParticipants) : "–"}
              </p>
            </div>
          </div>
        </Surface>

        {/* Answers */}
        <section className="flex flex-col gap-1">
          <SectionHeader title={t("lessonHistory.answerSection")} count={answers.length} />
          {answers.length === 0 ? (
            <EmptyState card icon={MessageSquareText} tone="neutral" headingLevel="h3" title={t("lessonHistory.emptyAnswers")} />
          ) : (
            <div className="flex flex-col gap-3">
              {answers.map((answer, index) => (
                <AnswerCard key={index} answer={answer} />
              ))}
            </div>
          )}
        </section>
      </HeroOverlap>
    </Screen>
  );
}
