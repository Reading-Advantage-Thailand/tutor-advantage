"use client";

/**
 * Free-text phases: 8 guided response (AI-scored), 13 guided writing
 * (AI-scored), 15 language questions (AI answers), 16 reflection. Same stage
 * language as the A–D questions: a prompt panel with the question in
 * Kodchasan and a speak button, "ส่งแล้ว n / N คน", the roster on the right;
 * AI score results as a chart + tone wells (the "needs work" count neutral,
 * never red, since children see the projector).
 */
import React from "react";
import { BarChart3, Bot, ChevronDown, Lock, MessageCircleQuestion, NotebookPen, PenLine } from "lucide-react";
import { IconTile, UserAvatar } from "@/components/app";
import type { AnswerData } from "@/lib/lesson-types";
import { t } from "@/lib/i18n";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";
import { AiRichText } from "./AiRichText";
import { AnswerTranslations } from "./AnswerTranslations";
import { LazyResultsBarChart, preloadResultsChart } from "./LazyResultsBarChart";
import {
  AnswerProgress,
  PreparationStatus,
  ResultStat,
  StageEyebrow,
  StageHeading,
  StagePanel,
  StageQuestion,
  StageSpeakButton,
} from "./primitives";
import { summariseAiScores } from "./questionModels";

const aiScore = (answer: AnswerData) => Number((answer.answer as any)?.aiScore || 0);

function SpeakButton({ onClick, tourTarget }: { onClick: () => void; tourTarget?: string }) {
  return (
    <StageSpeakButton
      onClick={onClick}
      tourTarget={tourTarget}
      label={t("lesson.interactive.speakTitle")}
      title={t("lesson.interactive.speakTitle")}
    />
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
    <StagePanel as="div" data-tour-target={tourTarget} className="flex w-full max-w-[1400px] flex-col gap-4 px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <StageEyebrow icon={icon}>{eyebrow}</StageEyebrow>
          <StageQuestion className="mt-1.5">{prompt}</StageQuestion>
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
        <UserAvatar key={a.studentId || i} name={a.name} src={a.pictureUrl} toneKey={a.studentId} size="nav" className="ring-2 ring-success-border ring-offset-2 ring-offset-app" />
      ))}
      {answers.length > 9 ? (
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface-muted text-[0.8125rem] font-semibold text-fg-muted tabular-nums shadow-[inset_0_0_0_1px_var(--clay-rim)]">
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
    { name: t("lesson.interactive.excellentRange"), count: summary.excellent, fill: "var(--success-solid)" },
    { name: t("lesson.interactive.goodRange"), count: summary.good, fill: "var(--info-solid)" },
    { name: t("lesson.interactive.improveRange"), count: summary.improve, fill: "var(--text-tertiary)" },
  ];
  // Sunshine is for rewards and red is never shown to the class: good = info, low = neutral.
  const averageTone = summary.average >= 4 ? "success" : summary.average >= 2 ? "info" : "neutral";

  return (
    <div data-tour-target={tourTarget} className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
      <StageHeading
        icon={Bot}
        tone="purple"
        title={title}
        aside={
          <p className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-sm leading-[1.6] text-fg-muted max-md:hidden">
            <Lock aria-hidden="true" className="size-3.5" />
            {t("lesson.interactive.privacyNote")}
          </p>
        }
      />
      <p className="inline-flex items-center gap-1.5 text-sm leading-[1.6] text-fg-muted md:hidden">
        <Lock aria-hidden="true" className="size-3.5" />
        {t("lesson.interactive.privacyNote")}
      </p>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem]">
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
          <ResultStat tone="info" label={t("lesson.interactive.goodRange")} value={summary.good} unit={t("lesson.interactive.peopleUnit")} />
          <ResultStat tone="neutral" label={t("lesson.interactive.improveRange")} value={summary.improve} unit={t("lesson.interactive.peopleUnit")} />
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
        <p className="max-w-3xl text-center text-base leading-[1.6] text-fg-muted xl:text-lg xl:leading-[1.6]">{thaiCopy(t("lesson.interactive.writingPlannerModel"))}</p>
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
        <StageHeading
          icon={MessageCircleQuestion}
          tone="orange"
          eyebrow={t("lesson.interactive.languageTitle")}
          title={t("lesson.interactive.languagePrompt")}
          className="w-full max-w-4xl"
        />
        <StagePanel data-tour-target={preparationMode ? "phase-15-question-list" : undefined} className="flex w-full max-w-4xl flex-col p-4 xl:p-5">
          <p className="mb-3 flex items-center gap-2 text-base font-semibold text-fg xl:text-lg">
            {t("lesson.interactive.languageQuestionsHeading")}
            <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-neutral-bg px-[7px] text-xs font-semibold text-neutral-fg tabular-nums">
              {questions.length}
            </span>
          </p>
          {questions.length > 0 ? (
            <ul className="flex max-h-[min(46dvh,420px)] flex-col gap-2 overflow-y-auto pr-1">
              {questions.map((q, i) => {
                const open = preparationMode || openIndex === i;
                return (
                  <li
                    key={i}
                    data-tour-target={preparationMode && i === 0 ? "phase-15-first-question" : undefined}
                    className="rounded-(--radius-ctl) border border-clay-rim bg-surface"
                  >
                    <button
                      type="button"
                      disabled={!q.languageAnswer || preparationMode}
                      aria-expanded={q.languageAnswer ? open : undefined}
                      onClick={() => setOpenIndex(open ? null : i)}
                      className="flex min-h-14 w-full items-start gap-3 rounded-(--radius-ctl) px-4 py-3 text-left text-lg leading-[1.45] text-fg transition-colors duration-(--duration-fast) enabled:hover:bg-row-hover disabled:cursor-default xl:text-xl"
                    >
                      <IconTile icon={MessageCircleQuestion} tone="orange" size="sm" />
                      <span className="min-w-0 flex-1 self-center">{q.text}</span>
                      {q.languageAnswer && !preparationMode ? (
                        <span className="inline-flex shrink-0 items-center gap-1 self-center text-sm font-semibold text-brand-fg">
                          {open ? t("lesson.live.hideAiAnswer") : t("lesson.live.showAiAnswer")}
                          <ChevronDown aria-hidden="true" className={open ? "size-4 rotate-180" : "size-4"} />
                        </span>
                      ) : null}
                    </button>
                    {q.languageAnswer && open ? (
                      <div
                        data-tour-target={preparationMode && i === 0 ? "phase-15-ai-answer" : undefined}
                        className="mx-3 mb-3 rounded-(--radius-ctl) border border-info-border bg-info-bg p-3"
                      >
                        <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-info-fg">
                          <Bot aria-hidden="true" className="size-4" />
                          {t("lesson.live.aiSuggestedAnswer")}
                        </p>
                        <AiRichText text={q.languageAnswer} className="text-base leading-relaxed text-fg" />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-(--radius-ctl) bg-surface-muted px-4 py-6 text-center text-base text-fg-muted">{t("lesson.interactive.languageNoQuestions")}</p>
          )}
          {preparationMode && showResults ? (
            <p className="mt-3 rounded-(--radius-ctl) border border-success-border bg-success-bg px-4 py-3 text-sm font-semibold text-success-fg">
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
        className="flex w-full max-w-4xl flex-col items-center px-6 py-8 text-center sm:px-10 sm:py-10"
      >
        <IconTile icon={NotebookPen} tone="orange" size="xl" />
        <StageEyebrow className="mt-4">{t("lesson.interactive.reflectionTitle")}</StageEyebrow>
        <StageQuestion className="mt-1.5">{thaiLabel(t("lesson.interactive.reflectionPrompt"))}</StageQuestion>
        {showResults ? (
          <>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-success-bg px-4 py-2 text-lg leading-[1.6] font-semibold text-success-fg">
              <span aria-hidden="true" className="size-2 rounded-full bg-current" />
              <span className="tabular-nums">{answers.length}</span> {t("lesson.interactive.reflectionSubmitted")}
            </p>
            {preparationMode ? (
              <div data-tour-target="phase-16-responses" className="mt-5 flex flex-col gap-2 text-left">
                {answers.map((answer) => {
                  const text =
                    typeof answer.answer === "object" ? String((answer.answer as any)?.text || "") : String(answer.answer || "");
                  return (
                    <div key={answer.studentId} className="rounded-(--radius-ctl) bg-surface-muted px-4 py-3">
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

