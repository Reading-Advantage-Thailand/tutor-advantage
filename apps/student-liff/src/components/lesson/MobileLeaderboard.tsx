import { Chip, ListGroup, ListRow, UserAvatar } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { rankParticipants } from "./leaderboardModel";
import { RankBadge } from "./RankBadge";

interface Participant {
  studentId: string;
  name: string;
  pictureUrl?: string;
  score?: number;
}

/**
 * Class ranking during the live lesson (and the final results on wrap-up):
 * medal/rank tile (competition ranking: ties share a rank; medals only for
 * podium players who scored), avatar (initials fallback, no external avatar service),
 * name ("คุณ" for the current student) and score. Server-compatible.
 */
export function MobileLeaderboard({ participants, studentId, title }: {
  participants: Participant[];
  studentId: string;
  /** Defaults to "อันดับตอนนี้". */
  title?: string;
}) {
  const { entries, myRank, myScore } = rankParticipants(participants, studentId);
  if (entries.length === 0) return null;
  const heading = title ?? t("interactivePlay.leaderboardTitle");

  return (
    <section aria-label={heading} className="w-full">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-2 px-1">
        <h3 className="text-[15px] leading-[1.5] font-bold text-fg">{heading}</h3>
        {myRank > 0 && myScore > 0 ? (
          <Chip tone="brand" size="sm">
            {t("interactivePlay.youRankPrefix")} {myRank}
          </Chip>
        ) : null}
      </div>
      <ListGroup>
        {entries.map(({ participant, rank, score, isMe, medal }, index) => (
          <ListRow
            key={participant.studentId || `row-${index}`}
            lines={1}
            className={cn(isMe && "bg-brand-soft")}
            leading={
              <span className="flex items-center gap-2">
                {/* Shared rank for ties; no medal and no rank ("–") until the player scores. */}
                <RankBadge rank={score > 0 ? rank : null} medal={medal} size="sm" />
                <UserAvatar src={participant.pictureUrl} name={participant.name || "?"} size="sm" decorative />
              </span>
            }
            title={<span className={cn(isMe && "text-brand-fg")}>{isMe ? t("interactivePlay.you") : participant.name}</span>}
            trailing={
              <span className="flex items-baseline gap-1">
                <span className={cn("text-[15px] leading-[1.5] font-bold tabular-nums", isMe ? "text-brand-fg" : "text-fg")}>{score}</span>
                <span className="text-xs leading-[1.5] text-fg-muted">{t("interactivePlay.pointsUnit")}</span>
              </span>
            }
          />
        ))}
      </ListGroup>
    </section>
  );
}
