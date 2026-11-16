import React from 'react';
import { Check, CheckCircle2, Star } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LessonParticipant } from '@/hooks/useLessonSocket';
import { LESSON_PHASE } from '@/lib/lessonPhases';
import { TextArea } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { MobileLeaderboard } from '../MobileLeaderboard';
import { lessonCardClass, PhaseColumn, PhaseIntroCard, StatusCard } from '../PhaseBlocks';

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

/**
 * 2-column choice group (1 column below 360px, so "เข้าใจนิดหน่อย" stays one
 * word); the selected label is what gets submitted (unchanged). Selection = jade + check.
 */
function ChoiceGroup({ title, options, value, onChange }: {
  title: string;
  options: { v: string; label: string }[];
  value: string;
  onChange: (label: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2.5 font-heading text-base leading-[1.45] font-semibold text-fg">{title}</legend>
      <div className="grid grid-cols-2 gap-2.5 max-[359px]:grid-cols-1">
        {options.map((o) => {
          const selected = value === o.label;
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.label)}
              className={cn(
                // px-2 below 390px: "✓ ต้องพยายามอีก" stays inside the button at 360.
                'clay-press relative flex min-h-12 items-center justify-center gap-1.5 rounded-[var(--radius-field)] border-2 px-3 py-2 text-[15px] leading-[1.6] font-semibold max-[389px]:px-2',
                selected
                  ? 'border-brand-fg bg-brand-soft text-brand-soft-fg shadow-[0_var(--ledge-sm)_0_var(--brand-soft-border)]'
                  : 'border-clay-rim bg-surface text-fg shadow-[0_var(--ledge-sm)_0_var(--clay-ledge)]',
              )}
            >
              {selected ? <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={3} /> : null}
              <span className="whitespace-nowrap">{o.label}</span>
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
      {/* The phase row above already shows the notebook tile: no second one here. */}
      <PhaseIntroCard
        tile={false}
        phase={LESSON_PHASE.REFLECTION}
        title={t("interactivePlay.reflectionTitle")}
        tip={t("interactivePlay.reflectionPrompt")}
      />

      {hasAnswered ? (
        <StatusCard tone="success" icon={CheckCircle2} title={t("interactivePlay.reflectionDone")} mascot="happy">
          {reviewRating > 0 && (
            <p className="mt-1 text-sm leading-[1.6] text-success-fg">
              <span aria-hidden="true">{'★'.repeat(reviewRating)}</span> {t("interactivePlay.tutorReviewSaved")}
            </p>
          )}
        </StatusCard>
      ) : (
        <section className={cn(lessonCardClass, "flex flex-col gap-5 px-[18px] pt-4 pb-[18px]")}>
          <ChoiceGroup title={t("interactivePlay.reflectionUnderstanding")} options={uOptions} value={understanding} onChange={setUnderstanding} />
          <ChoiceGroup title={t("interactivePlay.reflectionEffort")} options={eOptions} value={effort} onChange={setEffort} />

          <div className="border-t-[1.5px] border-hairline pt-4">
            <p className="font-heading text-base leading-[1.45] font-semibold text-fg">
              {t("interactivePlay.rateTutorTitle")} <span className="font-sans text-[13px] font-normal text-fg-muted">({t("common.optional")})</span>
            </p>
            <p className="mb-3 text-[13px] leading-[1.6] text-fg-muted">{t("interactivePlay.rateTutorHint")}</p>
            {/* gap 6 below 360px keeps each star ≥ 44px wide at 320. */}
            <div className="mb-4 grid grid-cols-5 gap-2 max-[359px]:gap-1.5">
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
                      'clay-press flex h-12 items-center justify-center rounded-[var(--radius-field)] border-2',
                      filled
                        ? 'border-warning-border bg-warning-bg text-warning-fg shadow-[0_var(--ledge-sm)_0_var(--warning-border)]'
                        : 'border-clay-rim bg-surface text-fg-muted shadow-[0_var(--ledge-sm)_0_var(--clay-ledge)]',
                    )}
                  >
                    <Star aria-hidden="true" className="size-6" fill={filled ? 'var(--warning-solid)' : 'none'} />
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

          {/* Below 375px "ส่งแบบสรุปการเรียนรู้และข้อคิดเห็น" is wider than the button: let it wrap to two lines. */}
          <Button
            variant="brand"
            size="cta-lg"
            className="w-full max-[374px]:h-auto max-[374px]:min-h-14 max-[374px]:px-4 max-[374px]:py-2 max-[374px]:leading-[1.6] max-[374px]:whitespace-normal"
            onClick={handleReflectionSubmit}
            disabled={!understanding || !effort || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? t("interactivePlay.sending") : t("interactivePlay.reflectionSubmit")}
          </Button>
        </section>
      )}

      <MobileLeaderboard participants={participants} studentId={studentId} show="focus" />
    </PhaseColumn>
  );
}
