import React from 'react';
import { Star } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LessonParticipant } from '@/hooks/useLessonSocket';
import { LESSON_PHASE } from '@/lib/lessonPhases';
import { TextArea } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { MobileLeaderboard } from '../MobileLeaderboard';
import { PhaseColumn, PhaseIntroCard, StatusCard } from '../PhaseBlocks';

interface LessonReflectionPhaseProps {
  hasAnswered: boolean;
  reviewRating: number;
  setReviewRating: (v: number) => void;
  reviewComment: string;
  setReviewComment: (v: string) => void;
  understanding: string;
  setUnderstanding: (v: string) => void;
  effort: string;
  setEffort: (v: string) => void;
  isSubmitting: boolean;
  handleReflectionSubmit: () => void;
  participants: LessonParticipant[];
  studentId: string;
}

/** 2-column choice group; the selected label is what gets submitted (unchanged). */
function ChoiceGroup({ title, options, value, onChange }: {
  title: string;
  options: { v: string; label: string }[];
  value: string;
  onChange: (label: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[15px] leading-[1.5] font-bold text-fg">{title}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const selected = value === o.label;
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.label)}
              className={cn(
                'pressable min-h-12 rounded-2xl border-2 px-3 py-2 text-[15px] leading-[1.4] font-semibold',
                selected ? 'border-warning-solid bg-warning-bg text-warning-fg' : 'border-hairline bg-surface text-fg-muted active:bg-press',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function LessonReflectionPhase({
  hasAnswered,
  reviewRating,
  setReviewRating,
  reviewComment,
  setReviewComment,
  understanding,
  setUnderstanding,
  effort,
  setEffort,
  isSubmitting,
  handleReflectionSubmit,
  participants,
  studentId
}: LessonReflectionPhaseProps) {
  const uOptions = [
    { v: 'all', label: t("interactivePlay.reflectionUnderstandingAll") },
    { v: 'most', label: t("interactivePlay.reflectionUnderstandingMost") },
    { v: 'some', label: t("interactivePlay.reflectionUnderstandingSome") },
    { v: 'little', label: t("interactivePlay.reflectionUnderstandingLittle") },
  ];
  const eOptions = [
    { v: 'great', label: t("interactivePlay.reflectionEffortGreat") },
    { v: 'good', label: t("interactivePlay.reflectionEffortGood") },
    { v: 'okay', label: t("interactivePlay.reflectionEffortOkay") },
    { v: 'needsWork', label: t("interactivePlay.reflectionEffortNeedsWork") },
  ];

  return (
    <PhaseColumn>
      <PhaseIntroCard
        phase={LESSON_PHASE.REFLECTION}
        title={t("interactivePlay.reflectionTitle")}
        tip={t("interactivePlay.reflectionPrompt")}
      />

      {hasAnswered ? (
        <StatusCard tone="success" emoji="✅" title={t("interactivePlay.reflectionDone")}>
          {reviewRating > 0 && (
            <p className="mt-1 text-sm leading-[1.5] text-success-fg">
              <span aria-hidden="true">{'★'.repeat(reviewRating)}</span> {t("interactivePlay.tutorReviewSaved")}
            </p>
          )}
        </StatusCard>
      ) : (
        <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
          <ChoiceGroup title={t("interactivePlay.reflectionUnderstanding")} options={uOptions} value={understanding} onChange={setUnderstanding} />
          <ChoiceGroup title={t("interactivePlay.reflectionEffort")} options={eOptions} value={effort} onChange={setEffort} />

          <div className="border-t border-hairline pt-4">
            <p className="text-[15px] leading-[1.5] font-bold text-fg">
              {t("interactivePlay.rateTutorTitle")} <span className="text-[13px] font-normal text-fg-muted">({t("common.optional")})</span>
            </p>
            <p className="mb-3 text-[13px] leading-[1.5] text-fg-muted">{t("interactivePlay.rateTutorHint")}</p>
            <div className="mb-4 grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((value) => {
                const filled = value <= reviewRating;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    aria-label={`${t("interactivePlay.rateStarsAriaPrefix")} ${value} ${t("interactivePlay.rateStarsAriaSuffix")}`}
                    aria-pressed={value === reviewRating}
                    className={cn(
                      'pressable flex h-12 items-center justify-center rounded-2xl border',
                      filled ? 'border-warning-border bg-warning-bg text-warning-solid' : 'border-hairline bg-fill-muted text-fg-subtle active:bg-press',
                    )}
                  >
                    <Star aria-hidden="true" className="size-6" fill={filled ? 'currentColor' : 'none'} />
                  </button>
                );
              })}
            </div>
            <TextArea
              label={t("interactivePlay.reviewCommentLabel")}
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder={t("interactivePlay.reviewCommentPlaceholder")}
              maxLength={500}
              textareaClassName="min-h-[96px]"
            />
          </div>

          <Button
            variant="brand"
            size="cta"
            className="w-full"
            onClick={handleReflectionSubmit}
            disabled={!understanding || !effort || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? t("interactivePlay.sending") : t("interactivePlay.reflectionSubmit")}
          </Button>
        </section>
      )}

      <MobileLeaderboard participants={participants} studentId={studentId} />
    </PhaseColumn>
  );
}
