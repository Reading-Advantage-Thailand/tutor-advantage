"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, CheckCircle2, Lightbulb, MessageSquareText, SearchX, XCircle } from "lucide-react";
import { useLiff } from "@/components/providers/LiffProvider";
import { formatPhaseStep, getPhaseMeta } from "@/components/lesson/phaseMeta";
import { RankBadge } from "@/components/lesson/RankBadge";
import { formatRankOf, getRankMeta } from "@/components/lesson/rankMeta";
import { AppBar, Chip, EmptyState, ErrorState, Screen, SectionHeader, StatusScreen, Surface } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DetailSkeleton } from "./_components/DetailSkeleton";
import { isNotFoundError, parseAnswerChoice } from "./_components/detailModel";

interface Answer {
  phase: number;
  score: number;
  question: string;
  answer: string;
  isCorrect: boolean;
  correctAnswer?: string;
  aiFeedback?: string;
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

function AnswerCard({ answer: a }: { answer: Answer }) {
  const choice = parseAnswerChoice(a.answer);
  const phaseLabel = `${formatPhaseStep(a.phase)} · ${getPhaseMeta(a.phase).label}`;
  const scored = a.score > 0;

  return (
    <Surface as="article" padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
        <p className="min-w-0 truncate text-[13px] leading-[1.5] font-semibold text-fg-muted">{phaseLabel}</p>
        <Chip tone={scored ? "success" : "danger"} size="sm" className="tabular-nums">
          +{a.score} {t("lessonHistory.pointsUnit")}
        </Chip>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p lang="en" className="text-base leading-[1.6] font-bold text-fg">
          {a.question || t("lessonHistory.questionFallback")}
        </p>

        {/* Student answer */}
        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-3",
            a.isCorrect ? "border-success-border bg-success-bg" : "border-danger-border bg-danger-bg",
          )}
        >
          {choice.label ? (
            <span
              aria-hidden="true"
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white",
                a.isCorrect ? "bg-brand-solid" : "bg-danger-solid",
              )}
            >
              {choice.label}
            </span>
          ) : a.isCorrect ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-success-fg" />
          ) : (
            <XCircle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-danger-fg" />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn("text-[13px] leading-[1.5] font-bold", a.isCorrect ? "text-success-fg" : "text-danger-fg")}>
              {t("lessonHistory.yourAnswer")} · {a.isCorrect ? t("lessonHistory.correctLabel") : t("lessonHistory.incorrectLabel")}
            </p>
            <p className="mt-0.5 text-[15px] leading-[1.5] font-semibold break-words text-fg">
              {choice.label ? <span className="sr-only">{choice.label}. </span> : null}
              {choice.text}
            </p>
          </div>
        </div>

        {/* Correct answer */}
        {!a.isCorrect && a.correctAnswer ? (
          <div className="flex items-start gap-3 rounded-2xl border border-warning-border bg-warning-bg p-3">
            <Lightbulb aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-fg" />
            <div className="min-w-0">
              <p className="text-[13px] leading-[1.5] font-bold text-warning-fg">{t("lessonHistory.correctAnswer")}</p>
              <p lang="en" className="mt-0.5 text-[15px] leading-[1.5] font-semibold break-words text-fg">{a.correctAnswer}</p>
            </div>
          </div>
        ) : null}

        {/* AI feedback */}
        {a.aiFeedback ? (
          <div className="flex items-start gap-3 rounded-2xl border border-info-border bg-info-bg p-3">
            <Bot aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info-fg" />
            <div className="min-w-0">
              <p className="text-[13px] leading-[1.5] font-bold text-info-fg">{t("lessonHistory.aiFeedbackLabel")}</p>
              <p className="mt-0.5 text-[15px] leading-[1.6] whitespace-pre-line text-fg">{a.aiFeedback}</p>
            </div>
          </div>
        ) : null}
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
        <ErrorState kind={errorCode === "network" ? "offline" : "error"} onRetry={retry} className="flex-1 justify-center" />
      </Screen>
    );
  }

  if (!detail?.session) {
    return (
      <Screen>
        {appBar}
        {error && !isNotFoundError(error) ? (
          <ErrorState
            description={t("lessonHistory.detailLoadFailed")}
            onRetry={() => void refetch()}
            retrying={isValidating}
            secondaryAction={backToHistory}
            className="flex-1 justify-center"
          />
        ) : (
          <StatusScreen
            icon={SearchX}
            tone="neutral"
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
      {appBar}
      <div className="flex flex-col gap-5 px-4 pt-3 pb-8">
        {/* Result hero */}
        <section className="rounded-[var(--radius-card)] bg-gradient-brand p-5 text-white shadow-[var(--shadow-card)]">
          <h2 lang="en" className="text-xl leading-[1.4] font-extrabold text-white">{session.articleTitle}</h2>
          <p className="mt-1 text-sm leading-[1.5] text-white/85">
            {t("lessonHistory.tutorPrefix")} {session.tutorName} · {formatThaiDate(session.date, "long")}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 px-3 py-2.5">
              <p className="text-xs leading-[1.5] text-white/85">{t("lessonHistory.scoreStat")}</p>
              <p className="text-[26px] leading-[1.3] font-extrabold tabular-nums">
                {session.totalScore}
                <span className="ml-1 text-sm font-semibold text-white/85">{t("lessonHistory.pointsUnit")}</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/15 px-3 py-2.5">
              {/* Fixed light tile on the brand hero: dark text so "#5" stays readable in dark mode too. */}
              {rankMeta.hasRank ? <RankBadge rank={rankMeta.rank} size="md" className="bg-white/90 text-slate-700" /> : null}
              <div className="min-w-0">
                <p className="text-xs leading-[1.5] text-white/85">{t("lessonHistory.rankLabel")}</p>
                <p className="text-[26px] leading-[1.3] font-extrabold tabular-nums">
                  {rankMeta.hasRank ? formatRankOf(rankMeta.rank, session.totalParticipants) : "–"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Answers */}
        <section>
          <SectionHeader title={t("lessonHistory.answerSection")} count={answers.length} className="mb-2" />
          {answers.length === 0 ? (
            <EmptyState icon={MessageSquareText} tone="neutral" title={t("lessonHistory.emptyAnswers")} />
          ) : (
            <div className="flex flex-col gap-3">
              {answers.map((answer, index) => (
                <AnswerCard key={index} answer={answer} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Screen>
  );
}
