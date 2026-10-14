import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mic } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LessonParticipant } from '@/hooks/useLessonSocket';
import { Notice } from '@/components/mobile';
import { Button, buttonVariants } from '@/components/ui/button';
import { Confetti } from '@/components/celebrate/Confetti';
import { MobileLeaderboard } from '../MobileLeaderboard';
import { PhaseColumn } from '../PhaseBlocks';
import { rankParticipants } from '../leaderboardModel';
import { getWrapUpCelebration } from '../rankMeta';

interface LessonWrapUpPhaseProps {
  participants: LessonParticipant[];
  studentId: string;
  classBookCycleId?: string;
  articleId?: string;
}

export function LessonWrapUpPhase({ participants, studentId, classBookCycleId, articleId }: LessonWrapUpPhaseProps) {
  const router = useRouter();
  const ranking = rankParticipants(participants, studentId);
  const score = ranking.myScore;
  const celebration = getWrapUpCelebration({
    rank: ranking.myRank,
    score,
    total: ranking.total,
    tied: ranking.myTied,
    allTied: ranking.allTied || ranking.noScores,
  });
  const canPracticeVoice = Boolean(classBookCycleId && articleId);

  return (
    <PhaseColumn>
      {/* Fires once when the wrap-up appears; later score/poll updates don't re-fire. */}
      {/* Finishing is always worth a small burst; "big" only for a real podium place. */}
      <Confetti intensity={celebration.confetti} />
      {/* Rank hero */}
      <section className="rounded-[var(--radius-card)] bg-hero px-5 py-7 text-center text-hero-fg shadow-[var(--shadow-card)]">
        <p aria-hidden="true" className="text-[64px] leading-[1.15]">{celebration.emoji}</p>
        <h2 className="mt-2 text-2xl leading-[1.35] font-extrabold">{celebration.title}</h2>
        <p className="mt-1 text-[15px] leading-[1.5] text-hero-fg-muted">{celebration.subtitle}</p>
      </section>

      {/* Score */}
      <section className="rounded-[var(--radius-card)] border border-hairline bg-surface p-5 text-center shadow-[var(--shadow-card)]">
        <p className="text-[13px] leading-[1.5] font-semibold text-fg-muted">{t("interactivePlay.totalScore")}</p>
        <p className="mt-1 text-[52px] leading-[1.15] font-black text-brand-fg tabular-nums">{score}</p>
        <p className="text-sm leading-[1.5] text-fg-muted">{t("interactivePlay.pointsUnit")}</p>
      </section>

      {/* Final leaderboard */}
      <MobileLeaderboard participants={participants} studentId={studentId} title={t("interactivePlay.finalResultsTitle")} />

      <Notice
        tone="success"
        title={t("interactivePlay.lessonCompletedTitle")}
        description={t("interactivePlay.lessonCompletedDescription")}
      />

      {/* One primary next step: talk with Reedy about this lesson. */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          variant="brand"
          size="cta"
          className="w-full"
          disabled={!canPracticeVoice}
          onClick={() => router.push(`/voice-practice?cycleId=${encodeURIComponent(classBookCycleId || '')}&articleId=${encodeURIComponent(articleId || '')}`)}
        >
          <Mic aria-hidden="true" />
          {t("interactivePlay.voicePracticeCta")}
        </Button>
        {!canPracticeVoice ? (
          <p className="text-center text-[13px] leading-[1.5] text-fg-muted">{t("interactivePlay.voicePracticeUnavailable")}</p>
        ) : null}
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "cta" }), "w-full text-fg-muted")}>
          {t("interactivePlay.backHome")}
        </Link>
      </div>
    </PhaseColumn>
  );
}
