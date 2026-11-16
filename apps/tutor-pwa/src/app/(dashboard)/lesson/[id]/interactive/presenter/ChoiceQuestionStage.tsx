"use client";

/**
 * A–D question phases (7, 9, 11, 12) on the presenter (patterns.md T10): the
 * question panel (Kodchasan, speak button), the four answer tiles 2×2 (max
 * 1400 wide) and "ส่งแล้ว 8 / 12 คน" while students answer, with the roster
 * on the right. The reveal shows the answer key and accuracy, the same tiles
 * with the correct one ringed and labelled "ถูกต้อง" (the others at .45),
 * then the per-option chart and the correct / wrong counts. When the answer
 * key does not match an option, no tile is ringed or faded.
 */
import React from "react";
import { CircleCheck, ListChecks } from "lucide-react";
import type { AnswerData } from "@/lib/lesson-types";
import { getChoiceAnswerLabel } from "@/lib/lessonAnswers";
import { t } from "@/lib/i18n";
import { thaiLabel } from "@/lib/thaiText";
import { AnswerTranslations } from "./AnswerTranslations";
import { LazyResultsBarChart, preloadResultsChart } from "./LazyResultsBarChart";
import {
  AnswerProgress,
  FALLBACK_OPTION_STYLE,
  OPTION_STYLES,
  OptionTile,
  PreparationStatus,
  ResultStat,
  StageEyebrow,
  StagePanel,
  StageQuestion,
  StageSpeakButton,
} from "./primitives";
import type { ChoiceQuestionModel } from "./questionModels";
import { summariseChoiceAnswers } from "./questionModels";
import type { LessonAudio } from "./useLessonAudio";

/** The app's own Thai lead-ins of a question (questionModels.ts); what follows them is lesson content. */
const QUESTION_LEAD_INS = [
  t("lesson.interactive.fillBlankPrefix"),
  t("lesson.interactive.orderSentencePrefix"),
  t("lesson.interactive.vocabQuestionPrefix"),
];

/**
 * The question heading with the words of its Thai lead-in kept whole
 * ("เติมคำใน" + "ช่องว่าง:"). The lesson text after the lead-in is left as
 * written, and the heading's text is the question, character for character.
 */
function questionHeading(question: string): React.ReactNode {
  const leadIn = QUESTION_LEAD_INS.find((prefix) => question.startsWith(`${prefix} `));
  if (!leadIn) return question;
  return (
    <>
      {thaiLabel(leadIn)}
      {question.slice(leadIn.length)}
    </>
  );
}

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
      fill: key === model.correct ? "var(--success-solid)" : (OPTION_STYLES[key] ?? FALLBACK_OPTION_STYLE).bar,
      correct: key === model.correct,
    }));

    const revealKeys = Object.keys(model.options).sort();
    // Only fade the other tiles when the key is a real option; otherwise every tile would look wrong.
    const keyKnown = model.correct in model.options;
    const correctWord = t("lesson.interactive.correctWord");
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div data-tour-target={tour("results")} className="flex min-w-0 flex-1 flex-col gap-4">
          <StagePanel className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <span
                aria-hidden="true"
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-(--radius-tile) bg-success-bg text-success-fg xl:size-14"
              >
                <CircleCheck className="size-7 xl:size-8" />
              </span>
              <div className="min-w-0 flex-1">
                <StageEyebrow>{t("lesson.interactive.correctAnswer")}</StageEyebrow>
                <p className="mt-0.5 text-2xl leading-[1.35] font-semibold break-words text-fg xl:text-[1.75rem]">
                  <span className="font-heading text-success-fg">{model.correct}</span> · {model.options[model.correct]}
                </p>
              </div>
              <div className="shrink-0 rounded-(--radius-ctl) bg-success-bg px-5 py-3 text-center">
                <p className="text-[2.5rem] leading-none font-semibold text-success-fg tabular-nums">{summary.accuracy}%</p>
                <p className="mt-1 text-sm font-medium text-fg-muted">{t("lesson.live.accuracy")}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {revealKeys.map((key) => (
                <OptionTile
                  key={key}
                  letter={key}
                  state={!keyKnown ? "default" : key === model.correct ? "correct" : "dimmed"}
                  correctLabel={correctWord}
                  className="min-h-16 py-3 xl:min-h-20"
                >
                  {model.options[key]}
                </OptionTile>
              ))}
            </div>
            {model.translationItems.length > 0 ? <AnswerTranslations items={model.translationItems} /> : null}
          </StagePanel>

          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_13rem]">
            <StagePanel className="flex min-h-[15rem] flex-col p-5">
              <StageEyebrow icon={ListChecks}>{t("lesson.interactive.answerSummary")}</StageEyebrow>
              <div className="mt-3 min-h-[11rem] flex-1">
                <LazyResultsBarChart data={data} correctLabel={correctWord} />
              </div>
            </StagePanel>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:content-start">
              <ResultStat tone="success" label={t("lesson.interactive.correctPrefix")} value={summary.correctCount} unit={t("lesson.interactive.peopleUnit")} />
              <ResultStat tone="neutral" label={t("lesson.interactive.wrongPrefix")} value={summary.wrongCount} unit={t("lesson.interactive.peopleUnit")} />
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
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4 lg:justify-center xl:gap-5">
        <StagePanel as="div" data-tour-target={tour("question")} className="w-full max-w-[1400px] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <StageEyebrow icon={ListChecks}>{t("lesson.live.multipleChoice")}</StageEyebrow>
              <StageQuestion className="mt-1.5">{questionHeading(model.question)}</StageQuestion>
            </div>
            {speakQuestion ? (
              <StageSpeakButton
                onClick={() => audio.playClip(model.audio.questionAudioUrl || model.sourceQuestion?.questionAudioUrl || model.sourceQuestion?.audioUrl, model.audio.questionAudioText || model.question)}
                tourTarget={tour("question-audio")}
                label={t("lesson.interactive.speakTitle")}
                title={t("lesson.interactive.speakTitle")}
              />
            ) : null}
          </div>
        </StagePanel>

        <div data-tour-target={tour("options")} className="grid w-full max-w-[1400px] grid-cols-1 gap-3 md:grid-cols-2 xl:gap-4">
          {displayKeys.map((key) => {
            const optionText = model.options[key];
            return (
              <OptionTile
                key={key}
                letter={key}
                onSpeak={
                  speakOptions
                    ? () =>
                        audio.playOption({
                          optionText,
                          label: key,
                          sourceQuestion: model.sourceQuestion,
                          optionAudioUrls: model.audio.optionAudioUrls,
                        })
                    : undefined
                }
                speakLabel={`${t("lesson.interactive.speakTitle")} ${key}`}
                speakTitle={t("lesson.interactive.speakTitle")}
              >
                {optionText}
              </OptionTile>
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
