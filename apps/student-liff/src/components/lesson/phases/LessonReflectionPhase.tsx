import React from 'react';
import { t } from '@/lib/i18n';
import { MobileLeaderboard } from '../MobileLeaderboard';

import { LessonParticipant } from '@/hooks/useLessonSocket';

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
    <div className="phase-enter w-full max-w-md flex flex-col gap-4 overflow-y-auto max-h-[calc(100dvh-80px)] pb-4">
      <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-6 text-center">
        <div className="text-5xl mb-2">📝</div>
        <h2 className="text-xl font-black text-amber-600 dark:text-amber-400">{t("interactivePlay.reflectionTitle")}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t("interactivePlay.reflectionPrompt")}</p>
      </div>

      {hasAnswered ? (
        <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-2">✅</div>
          <h3 className="font-black text-emerald-600 dark:text-emerald-400 text-lg">{t("interactivePlay.reflectionDone")}</h3>
          {reviewRating > 0 && (
            <p className="text-emerald-600/70 dark:text-emerald-400/70 text-sm mt-1">{'★'.repeat(reviewRating)} บันทึกรีวิวคุณครูแล้ว</p>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-3xl border border-border shadow-lg p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-foreground mb-2">{t("interactivePlay.reflectionUnderstanding")}</p>
            <div className="grid grid-cols-2 gap-2">
              {uOptions.map((o) => (
                <button
                  key={o.v}
                  onClick={() => setUnderstanding(o.label)}
                  className={`rounded-2xl border-2 py-2.5 text-sm font-bold transition-all active:scale-95 ${understanding === o.label ? 'border-amber-400 bg-amber-400/15 text-amber-600' : 'border-border bg-muted/40 text-muted-foreground'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground mb-2">{t("interactivePlay.reflectionEffort")}</p>
            <div className="grid grid-cols-2 gap-2">
              {eOptions.map((o) => (
                <button
                  key={o.v}
                  onClick={() => setEffort(o.label)}
                  className={`rounded-2xl border-2 py-2.5 text-sm font-bold transition-all active:scale-95 ${effort === o.label ? 'border-amber-400 bg-amber-400/15 text-amber-600' : 'border-border bg-muted/40 text-muted-foreground'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-bold text-foreground">ให้คะแนนคุณครู <span className="text-muted-foreground font-normal text-xs">(ไม่บังคับ)</span></p>
            <p className="text-muted-foreground text-xs leading-relaxed mb-2">คะแนนนี้จะถูกนำไปคำนวณเรตติ้งเฉลี่ยจริงของคุณครู</p>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReviewRating(value)}
                  aria-label={`ให้ ${value} ดาว`}
                  className={`h-12 rounded-2xl border text-2xl transition-all active:scale-95 ${value <= reviewRating ? 'border-amber-400 bg-amber-400/15 text-amber-500' : 'border-border bg-muted/40 text-muted-foreground'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="เล่าความประทับใจหรือข้อเสนอแนะเพิ่มเติม"
              maxLength={500}
              className="min-h-20 w-full resize-y rounded-2xl border border-border bg-background p-3 text-sm font-medium text-foreground outline-none focus:border-amber-400"
            />
          </div>

          <button
            onClick={handleReflectionSubmit}
            disabled={!understanding || !effort || isSubmitting}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-base py-4 rounded-2xl shadow-lg disabled:opacity-40 active:scale-95 transition-all"
          >
            {isSubmitting ? 'กำลังส่ง...' : t("interactivePlay.reflectionSubmit")}
          </button>
        </div>
      )}

      <MobileLeaderboard participants={participants} studentId={studentId} />
    </div>
  );
}
