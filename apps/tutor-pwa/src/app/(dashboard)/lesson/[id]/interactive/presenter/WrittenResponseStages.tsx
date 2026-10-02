"use client";

/**
 * Free-text phases: 8 guided response (AI-scored), 13 guided writing
 * (AI-scored), 15 language questions (AI answers), 16 reflection.
 */
import React from "react";
import { BarChart3, Bot, Lock, MessageCircleQuestion, NotebookPen, PenLine, Volume2 } from "lucide-react";
import { UserAvatar } from "@/components/app";
import type { AnswerData } from "@/lib/lesson-types";
import { t } from "@/lib/i18n";
import { AnswerTranslations } from "./AnswerTranslations";
import { LazyResultsBarChart, preloadResultsChart } from "./LazyResultsBarChart";
import { AnswerProgress, PreparationStatus, ResultStat, StageEyebrow, StagePanel } from "./primitives";
import { summariseAiScores } from "./questionModels";

const aiScore = (answer: AnswerData) => Number((answer.answer as any)?.aiScore || 0);

const speakButtonClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-fg transition-colors hover:bg-brand-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function SpeakButton({ onClick, tourTarget }: { onClick: () => void; tourTarget?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour-target={tourTarget}
      aria-label={t("lesson.interactive.speakTitle")}
      title={t("lesson.interactive.speakTitle")}
      className={speakButtonClass}
    >
      <Volume2 aria-hidden="true" className="size-5" />
    </button>
  );
}

function PromptCard({
  eyebrow,
  icon,
  prompt,
  onSpeak,
  tourTarget,
  audioTourTarget,
  children,
}: {
  eyebrow: string;
  icon: typeof PenLine;
  prompt: string;
  onSpeak?: () => void;
  tourTarget?: string;
  audioTourTarget?: string;
  children?: React.ReactNode;
}) {
  return (
    <StagePanel as="div" data-tour-target={tourTarget} className="flex w-full max-w-4xl flex-col gap-4 px-6 py-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <StageEyebrow icon={icon}>{eyebrow}</StageEyebrow>
          <h3 className="mt-1.5 break-words text-2xl font-semibold leading-snug text-fg xl:text-3xl">{prompt}</h3>
        </div>
        {onSpeak ? <SpeakButton onClick={onSpeak} tourTarget={audioTourTarget} /> : null}
      </div>
      {children}
    </StagePanel>
  );
}

/** Avatars of the students who already submitted (max 9 + overflow). */
function SubmittedAvatars({ answers }: { answers: AnswerData[] }) {
  if (answers.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {answers.slice(0, 9).map((a, i) => (
        <UserAvatar key={a.studentId || i} name={a.name} src={a.pictureUrl} size="sm" className="ring-2 ring-success-border" />
      ))}
      {answers.length > 9 ? (
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-fill-muted text-xs font-semibold text-fg-muted">
          +{answers.length - 9}
        </span>
      ) : null}
    </div>
  );
}

interface WaitingProps {
  totalAnswered: number;
  totalParticipants: number;
  preparationStatusText?: string | null;
  statusTourTarget?: string;
}

function Waiting({ totalAnswered, totalParticipants, preparationStatusText, statusTourTarget }: WaitingProps) {
  return (
    <AnswerProgress
      data-tour-target={statusTourTarget}
      answered={totalAnswered}
      total={totalParticipants}
      label={t("lesson.interactive.answersSubmitted")}
      note={<PreparationStatus text={preparationStatusText ?? null} />}
    />
  );
}

/** Score distribution + average for AI-scored answers (phases 8 and 13). */
function AiScoreResults({ answers, title, tourTarget }: { answers: AnswerData[]; title: string; tourTarget?: string }) {
  const summary = summariseAiScores(answers.map(aiScore));
  const chartData = [
    { name: t("lesson.interactive.excellentRange"), count: summary.excellent, fill: "#16a34a" },
    { name: t("lesson.interactive.goodRange"), count: summary.good, fill: "#f59e0b" },
    { name: t("lesson.interactive.improveRange"), count: summary.improve, fill: "#e11d48" },
  ];
  const averageTone = summary.average >= 4 ? "success" : summary.average >= 2 ? "warning" : "danger";

  return (
    <div data-tour-target={tourTarget} className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StageEyebrow icon={Bot} className="text-base">
          {title}
        </StageEyebrow>
        <p className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
          <Lock aria-hidden="true" className="size-3.5" />
          {t("lesson.interactive.privacyNote")}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <StagePanel className="flex min-h-[16rem] flex-col p-5">
          <StageEyebrow icon={BarChart3}>{t("lesson.interactive.scoreDistributionChart")}</StageEyebrow>
          <div className="mt-3 min-h-[12rem] flex-1">
            <LazyResultsBarChart data={chartData} maxBarSize={64} tickSize={14} />
          </div>
        </StagePanel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:content-start">
          <ResultStat
            className="col-span-2 md:col-span-1"
            tone={averageTone}
            label={t("lesson.interactive.averageScore")}
            value={summary.average.toFixed(1)}
            unit="/ 5"
          />
          <ResultStat tone="neutral" label={t("lesson.interactive.allSubmitted")} value={answers.length} unit={t("lesson.interactive.peopleUnit")} />
          <ResultStat tone="success" label={t("lesson.interactive.excellentRange")} value={summary.excellent} unit={t("lesson.interactive.peopleUnit")} />
          <ResultStat tone="warning" label={t("lesson.interactive.goodRange")} value={summary.good} unit={t("lesson.interactive.peopleUnit")} />
          <ResultStat tone="danger" label={t("lesson.interactive.improveRange")} value={summary.improve} unit={t("lesson.interactive.peopleUnit")} />
        </div>
      </div>
    </div>
  );
}

export interface WrittenStageCommon {
  currentPhase: number;
  showResults: boolean;
  answers: AnswerData[];
  totalAnswered: number;
  totalParticipants: number;
  roster: React.ReactNode;
  preparationMode?: boolean;
  preparationStatusText?: string | null;
}

/** Phase 8: guided short answer. */
export function ShortAnswerStage({
  question,
  onSpeak,
  ...common
}: WrittenStageCommon & { question?: string; onSpeak?: () => void }) {
  const { currentPhase, showResults, answers, roster, preparationMode } = common;
  React.useEffect(() => {
    if (!showResults) preloadResultsChart();
  }, [showResults]);

  if (showResults) {
    return (
      <AiScoreResults
        answers={answers}
        title={t("lesson.interactive.shortAnswerResults")}
        tourTarget={preparationMode ? `phase-${currentPhase}-results` : undefined}
      />
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col items-center gap-5 lg:justify-center">
        <PromptCard
          eyebrow={t("lesson.live.shortAnswer")}
          icon={PenLine}
          prompt={question || t("lesson.interactive.shortAnswerPrompt")}
          onSpeak={question ? onSpeak : undefined}
          tourTarget={preparationMode ? "phase-8-question" : undefined}
          audioTourTarget={preparationMode ? "phase-8-question-audio" : undefined}
        />
        <Waiting {...common} statusTourTarget={preparationMode ? "phase-8-student-status" : undefined} />
        <SubmittedAvatars answers={answers} />
      </div>
      {roster}
    </div>
  );
}

/** Phase 13: guided writing. */
export function WritingStage({
  prompt,
  hasQuestion,
  onSpeak,
  ...common
}: WrittenStageCommon & { prompt: string; hasQuestion: boolean; onSpeak?: () => void }) {
  const { currentPhase, showResults, answers, roster, preparationMode } = common;
  React.useEffect(() => {
    if (!showResults) preloadResultsChart();
  }, [showResults]);

  if (showResults) {
    return (
      <AiScoreResults
        answers={answers}
        title={t("lesson.interactive.writingResults")}
        tourTarget={preparationMode ? `phase-${currentPhase}-results` : undefined}
      />
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col items-center gap-5 lg:justify-center">
        <PromptCard
          eyebrow={t("lesson.interactive.writingTitle")}
          icon={NotebookPen}
          prompt={prompt}
          onSpeak={hasQuestion ? onSpeak : undefined}
          tourTarget={preparationMode ? "phase-13-writing" : undefined}
          audioTourTarget={preparationMode ? "phase-13-question-audio" : undefined}
        >
          <AnswerTranslations items={[{ label: "", text: prompt }]} />
        </PromptCard>
        <p className="max-w-2xl text-center text-base text-fg-muted">{t("lesson.interactive.writingPlannerModel")}</p>
        <Waiting {...common} statusTourTarget={preparationMode ? "phase-13-student-status" : undefined} />
      </div>
      {roster}
    </div>
  );
}

/** Phase 15: students' language questions with the AI's suggested answer. */
export function LanguageQuestionsStage(common: WrittenStageCommon) {
  const { showResults, answers, roster, preparationMode } = common;
  const questions = answers
    .map((a) => (typeof a.answer === "object" ? a.answer : { text: a.answer }))
    .filter((q: any) => Boolean(q?.text)) as Array<{ text: string; languageAnswer?: string }>;
  const [openIndex, setOpenIndex] = React.useState<number | null>(preparationMode ? 0 : null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
        <div className="max-w-3xl text-center">
          <StageEyebrow icon={MessageCircleQuestion}>{t("lesson.interactive.languageTitle")}</StageEyebrow>
          <p className="mt-1 text-lg text-fg">{t("lesson.interactive.languagePrompt")}</p>
        </div>
        <StagePanel data-tour-target={preparationMode ? "phase-15-question-list" : undefined} className="flex w-full max-w-3xl flex-col p-4">
          <p className="mb-3 text-base font-semibold text-fg">
            {t("lesson.interactive.languageQuestionsHeading")}{" "}
            <span className="font-normal text-fg-muted">({questions.length})</span>
          </p>
          {questions.length > 0 ? (
            <ul className="flex max-h-[min(46dvh,420px)] flex-col gap-2 overflow-y-auto pr-1">
              {questions.map((q, i) => {
                const open = preparationMode || openIndex === i;
                return (
                  <li
                    key={i}
                    data-tour-target={preparationMode && i === 0 ? "phase-15-first-question" : undefined}
                    className="rounded-lg border border-hairline bg-surface-muted"
                  >
                    <button
                      type="button"
                      disabled={!q.languageAnswer || preparationMode}
                      aria-expanded={q.languageAnswer ? open : undefined}
                      onClick={() => setOpenIndex(open ? null : i)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left text-lg leading-snug text-fg disabled:cursor-default"
                    >
                      <MessageCircleQuestion aria-hidden="true" className="mt-1 size-5 shrink-0 text-brand-fg" />
                      <span className="min-w-0 flex-1">{q.text}</span>
                      {q.languageAnswer && !preparationMode ? (
                        <span className="shrink-0 text-sm font-medium text-brand-fg">
                          {open ? t("lesson.live.hideAiAnswer") : t("lesson.live.showAiAnswer")}
                        </span>
                      ) : null}
                    </button>
                    {q.languageAnswer && open ? (
                      <div
                        data-tour-target={preparationMode && i === 0 ? "phase-15-ai-answer" : undefined}
                        className="mx-3 mb-3 rounded-lg border border-info-border bg-info-bg p-3"
                      >
                        <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-info-fg">
                          <Bot aria-hidden="true" className="size-4" />
                          {t("lesson.live.aiSuggestedAnswer")}
                        </p>
                        <p className="whitespace-pre-wrap text-base leading-relaxed text-fg">{q.languageAnswer}</p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-base text-fg-muted">{t("lesson.interactive.languageNoQuestions")}</p>
          )}
          {preparationMode && showResults ? (
            <p className="mt-3 rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm font-semibold text-success-fg">
              {t("lesson.live.languagePreparationSummary")}
            </p>
          ) : null}
        </StagePanel>
        <Waiting {...common} statusTourTarget={preparationMode ? "phase-15-student-status" : undefined} />
      </div>
      {roster}
    </div>
  );
}

/** Phase 16: lesson reflection. */
export function ReflectionStage(common: WrittenStageCommon) {
  const { showResults, answers, preparationMode } = common;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4">
      <StagePanel
        as="div"
        data-tour-target={preparationMode ? "phase-16-reflection" : undefined}
        className="w-full max-w-3xl px-8 py-10 text-center"
      >
        <NotebookPen aria-hidden="true" className="mx-auto size-10 text-brand-fg" />
        <StageEyebrow className="mt-3">{t("lesson.interactive.reflectionTitle")}</StageEyebrow>
        <p className="mt-2 text-2xl font-semibold leading-snug text-fg xl:text-3xl">{t("lesson.interactive.reflectionPrompt")}</p>
        {showResults ? (
          <>
            <p className="mt-4 text-lg font-semibold text-success-fg">
              {answers.length} {t("lesson.interactive.reflectionSubmitted")}
            </p>
            {preparationMode ? (
              <div data-tour-target="phase-16-responses" className="mt-5 flex flex-col gap-2 text-left">
                {answers.map((answer) => {
                  const text =
                    typeof answer.answer === "object" ? String((answer.answer as any)?.text || "") : String(answer.answer || "");
                  return (
                    <div key={answer.studentId} className="rounded-lg border border-hairline bg-surface-muted px-3 py-2">
                      <p className="text-sm font-semibold text-fg-muted">{answer.name}</p>
                      <p className="mt-0.5 text-base leading-relaxed text-fg">{text || "-"}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
      </StagePanel>
      <Waiting {...common} statusTourTarget={preparationMode ? "phase-16-student-status" : undefined} />
    </div>
  );
}

