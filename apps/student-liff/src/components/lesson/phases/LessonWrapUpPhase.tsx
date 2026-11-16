import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mic } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LessonParticipant } from '@/hooks/useLessonSocket';
import { Chip, Notice } from '@/components/mobile';
import { ReedyMini } from '@/components/mascot/ReedyMini';
import { Button, buttonVariants } from '@/components/ui/button';
import { Confetti } from '@/components/celebrate/Confetti';
import { LeaderboardGap, LeaderboardRow, MobileLeaderboard } from '../MobileLeaderboard';
import { lessonCardClass, PhaseColumn } from '../PhaseBlocks';
import { Podium } from '../Podium';
import { rankParticipants } from '../leaderboardModel';
import { getWrapUpCelebration } from '../rankMeta';

interface LessonWrapUpPhaseProps {
  participants: LessonParticipant[];
  studentId: string;
  classBookCycleId?: string;
  articleId?: string;
}

/**
 * Wrap-up results (patterns.md S8): headline from the data + Reedy, the total
 * score, the podium (scoring top three), your own row when you are below it,
 * and the one reward action "ฝึกพูดกับรีดี้". Confetti once (none under
 * reduced motion).
 */
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

  // Podium = the scoring top three; your row follows it unless you stand on it.
  const podiumCount = ranking.entries.slice(0, 3).filter((entry) => entry.medal).length;
  const myIndex = ranking.entries.findIndex((entry) => entry.isMe);
  const myEntry = myIndex >= 0 ? ranking.entries[myIndex] : null;
  const onPodium = myEntry !== null && myIndex < 3 && myEntry.medal;
  const showMyRow = podiumCount > 0 && myEntry !== null && !onPodium;

  return (
    <PhaseColumn>
      {/* Fires once when the wrap-up appears; later score/poll updates don't re-fire. */}
      {/* Finishing is always worth a small burst; "big" only for a real podium place. */}
      <Confetti intensity={celebration.confetti} />

      <section aria-labelledby="wrapup-title" className={cn(lessonCardClass, "overflow-hidden")}>
        <div className="flex items-center gap-2 py-4 pr-2 pl-[18px]">
          <div className="min-w-0 flex-1">
            <h2 id="wrapup-title" className="font-heading text-2xl leading-[1.3] font-bold text-balance text-fg">
              {celebration.title}
            </h2>
            <p className="mt-1 text-[15px] leading-[1.6] text-fg-muted">{celebration.subtitle}</p>
          </div>
          <ReedyMini mood={celebration.confetti === "small" ? "happy" : "cheer"} size="xl" decorative />
        </div>

        <div className="mx-[18px] mb-4 flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-4 py-2.5">
          <p className="text-sm leading-[1.6] text-fg-muted">{t("interactivePlay.totalScore")}</p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[28px] leading-[1.2] font-semibold text-fg tabular-nums">{score}</span>
            <span className="text-sm leading-[1.6] text-fg-muted">{t("interactivePlay.pointsUnit")}</span>
          </p>
        </div>

        {podiumCount > 0 ? (
          <div className="border-t-[1.5px] border-hairline px-4 pt-3">
            <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
              <h3 className="font-heading text-base leading-[1.45] font-semibold text-fg">{t("interactivePlay.finalResultsTitle")}</h3>
              {ranking.myRank > 0 && score > 0 ? (
                <Chip tone="brand" size="md">
                  {t("interactivePlay.youRankPrefix")} <span className="font-sans tabular-nums">{ranking.myRank}</span>
                </Chip>
              ) : null}
            </div>
            <Podium entries={ranking.entries} />
          </div>
        ) : null}

        {/* Rows 4+: only your own row (after "…" when places are skipped), straight under the podium. */}
        {showMyRow && myEntry ? (
          <ol aria-label={t("interactivePlay.finalResultsTitle")} className="list-none border-t-[1.5px] border-hairline">
            {myIndex > podiumCount ? <LeaderboardGap divider={false} /> : null}
            <LeaderboardRow
              participant={myEntry.participant}
              rank={myEntry.rank}
              score={myEntry.score}
              isMe
              medal={myEntry.medal}
              divider={myIndex > podiumCount}
            />
          </ol>
        ) : null}
      </section>

      {/* Nobody scored: no podium, so the plain final list stays. */}
      {podiumCount === 0 ? (
        <MobileLeaderboard participants={participants} studentId={studentId} title={t("interactivePlay.finalResultsTitle")} />
      ) : null}

      <Notice
        tone="success"
        title={t("interactivePlay.lessonCompletedTitle")}
        description={t("interactivePlay.lessonCompletedDescription")}
      />

      {/* One reward next step: talk with Reedy about this lesson. */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          variant="reward"
          size="cta-lg"
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
