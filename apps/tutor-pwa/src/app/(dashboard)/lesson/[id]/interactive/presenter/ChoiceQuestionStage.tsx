"use client";

/**
 * A–D question phases (7, 9, 11, 12): question + four coloured options while
 * students answer, then the answer key, accuracy and a per-option chart.
 */
import React from "react";
import { CircleCheck, ListChecks, Volume2 } from "lucide-react";
import type { AnswerData } from "@/lib/lesson-types";
import { getChoiceAnswerLabel } from "@/lib/lessonAnswers";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AnswerTranslations } from "./AnswerTranslations";
import { LazyResultsBarChart, preloadResultsChart } from "./LazyResultsBarChart";
import {
  AnswerProgress,
  FALLBACK_OPTION_STYLE,
  OPTION_STYLES,
  PreparationStatus,
  ResultStat,
  StageEyebrow,
  StagePanel,
} from "./primitives";
import type { ChoiceQuestionModel } from "./questionModels";
import { summariseChoiceAnswers } from "./questionModels";
import type { LessonAudio } from "./useLessonAudio";

export interface ChoiceQuestionStageProps {
  model: ChoiceQuestionModel;
  currentPhase: number;
  showResults: boolean;
  answers: AnswerData[];
  totalAnswered: number;
  totalParticipants: number;
  audio: Pick<LessonAudio, "playClip" | "playOption">;
  roster: React.ReactNode;
  preparationMode?: boolean;
  preparationStatusText?: string | null;
}

const speakButtonClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ChoiceQuestionStage({
  model,
  currentPhase,
  showResults,
  answers,
  totalAnswered,
  totalParticipants,
  audio,
  roster,
  preparationMode = false,
  preparationStatusText,
}: ChoiceQuestionStageProps) {
  const tour = (suffix: string) => (preparationMode ? `phase-${currentPhase}-${suffix}` : undefined);

  React.useEffect(() => {
    if (!showResults) preloadResultsChart();
  }, [showResults]);

  if (showResults) {
    const summary = summariseChoiceAnswers(
      answers.map((answer) => getChoiceAnswerLabel(answer.answer)),
      model.correct,
    );
    const data = summary.counts.map(({ key, count }) => ({
      name: key,
      count,
      fill: key === model.correct ? "#16a34a" : (OPTION_STYLES[key] ?? FALLBACK_OPTION_STYLE).bar,
    }));

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div data-tour-target={tour("results")} className="flex min-w-0 flex-1 flex-col gap-4">
          <StagePanel className="flex flex-col gap-4 border-success-border p-5">
            <div className="flex flex-wrap items-center gap-4">
              <CircleCheck aria-hidden="true" className="size-10 shrink-0 text-success-fg" />
              <div className="min-w-0 flex-1">
                <StageEyebrow>{t("lesson.interactive.correctAnswer")}</StageEyebrow>
                <p className="mt-1 text-2xl font-bold leading-snug text-fg xl:text-3xl">
                  <span className="text-success-fg">{model.correct}</span> · {model.options[model.correct]}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-success-bg px-5 py-3 text-center">
                <p className="text-4xl font-bold tabular-nums text-success-fg">{summary.accuracy}%</p>
                <p className="text-sm text-fg-muted">{t("lesson.live.accuracy")}</p>
              </div>
            </div>
            {model.translationItems.length > 0 ? <AnswerTranslations items={model.translationItems} /> : null}
          </StagePanel>

          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
            <StagePanel className="flex min-h-[15rem] flex-col p-5">
              <StageEyebrow icon={ListChecks}>{t("lesson.interactive.answerSummary")}</StageEyebrow>
              <div className="mt-3 min-h-[11rem] flex-1">
                <LazyResultsBarChart data={data} />
              </div>
            </StagePanel>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:content-start">
              <ResultStat tone="success" label={t("lesson.interactive.correctPrefix")} value={summary.correctCount} unit={t("lesson.interactive.peopleUnit")} />
              <ResultStat tone="danger" label={t("lesson.interactive.wrongPrefix")} value={summary.wrongCount} unit={t("lesson.interactive.peopleUnit")} />
            </div>
          </div>
        </div>
        {roster}
      </div>
    );
  }

  const displayKeys = Object.keys(model.options).sort();
  const speakQuestion = model.audio.speakQuestion !== false;
  const speakOptions = model.audio.speakOptions !== false;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4 lg:justify-center">
        <StagePanel as="div" data-tour-target={tour("question")} className="w-full max-w-4xl px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <StageEyebrow>{t("lesson.live.multipleChoice")}</StageEyebrow>
              <h3 className="mt-1.5 break-words text-2xl font-semibold leading-snug text-fg xl:text-3xl">{model.question}</h3>
            </div>
            {speakQuestion ? (
              <button
                type="button"
                onClick={() => audio.playClip(model.audio.questionAudioUrl || model.sourceQuestion?.questionAudioUrl || model.sourceQuestion?.audioUrl, model.audio.questionAudioText || model.question)}
                data-tour-target={tour("question-audio")}
                aria-label={t("lesson.interactive.speakTitle")}
                title={t("lesson.interactive.speakTitle")}
                className={cn(speakButtonClass, "bg-brand-soft text-brand-fg hover:bg-brand-soft/70")}
              >
                <Volume2 aria-hidden="true" className="size-5" />
              </button>
            ) : null}
          </div>
        </StagePanel>

        <div data-tour-target={tour("options")} className="grid w-full max-w-4xl grid-cols-2 gap-3">
          {displayKeys.map((key) => {
            const style = OPTION_STYLES[key] ?? FALLBACK_OPTION_STYLE;
            const optionText = model.options[key];
            return (
              <div key={key} className={cn("flex min-h-20 min-w-0 items-center gap-3 rounded-xl p-4", style.tile)}>
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg text-xl font-bold", style.badge)}>
                  {key}
                </span>
                <span className="min-w-0 flex-1 whitespace-normal break-words text-lg font-semibold leading-snug xl:text-xl">
                  {optionText}
                </span>
                {speakOptions ? (
                  <button
                    type="button"
                    onClick={() =>
                      audio.playOption({
                        optionText,
                        label: key,
                        sourceQuestion: model.sourceQuestion,
                        optionAudioUrls: model.audio.optionAudioUrls,
                      })
                    }
                    aria-label={`${t("lesson.interactive.speakTitle")} ${key}`}
                    title={t("lesson.interactive.speakTitle")}
                    className={cn(speakButtonClass, "size-9 bg-black/15 hover:bg-black/25")}
                  >
                    <Volume2 aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <AnswerProgress
          data-tour-target={tour("student-status")}
          answered={totalAnswered}
          total={totalParticipants}
          label={t("lesson.interactive.answersSubmitted")}
          note={<PreparationStatus text={preparationStatusText ?? null} />}
        />
      </div>
      {roster}
    </div>
  );
}
