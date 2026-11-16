import { ArrowDown, ArrowUp } from "lucide-react";
import { Chip, UserAvatar } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { rankParticipants } from "./leaderboardModel";
import { RankBadge } from "./RankBadge";

export interface LeaderboardParticipant {
  studentId: string;
  name: string;
  pictureUrl?: string;
  score?: number;
  /** Optional rank change since the last ranking (+ up, − down); shown as an arrow + number. */
  rankMove?: number;
}

/** How many podium rows to keep before "…" and your own row. */
const PODIUM_ROWS = 3;

/** The "…" row between the top three and your own row (32px, decorative). */
export function LeaderboardGap({ divider = true }: { divider?: boolean }) {
  return (
    <li
      aria-hidden="true"
      className={cn(
        "flex min-h-8 items-center justify-center text-base leading-none font-semibold text-fg-subtle",
        divider && "border-t-[1.5px] border-hairline",
      )}
    >
      …
    </li>
  );
}

/**
 * One 56px leaderboard row (components.md §6.4): rank cell (medal disc for a
 * scoring top three, "–" before a first score), avatar 36, name ("คุณ" for the
 * viewer, reading face — never Kodchasan), optional rank move with words for
 * screen readers, and the score (tabular) + "คะแนน". Your row: soft jade fill,
 * a 3px jade bar and aria-current.
 */
export function LeaderboardRow({ participant, rank, score, isMe, medal, divider }: {
  participant: LeaderboardParticipant;
  rank: number;
  score: number;
  isMe: boolean;
  medal: boolean;
  /** Top hairline (every row but the first). */
  divider?: boolean;
}) {
  const move = participant.rankMove;
  return (
    <li
      aria-current={isMe ? "true" : undefined}
      className={cn(
        "flex min-h-14 items-center gap-3 px-4 py-1.5",
        divider && "border-t-[1.5px] border-hairline",
        isMe && "bg-brand-soft shadow-[inset_3px_0_0_var(--brand-solid)]",
      )}
    >
      {/* Shared rank for ties; no medal and no rank ("–") until the player scores. */}
      <RankBadge rank={score > 0 ? rank : null} medal={medal} size="sm" variant="plain" />
      <UserAvatar src={participant.pictureUrl} name={participant.name || "?"} size="rank" ring={isMe ? "you" : "none"} decorative />
      <span
        title={isMe ? undefined : participant.name}
        className={cn("min-w-0 flex-1 truncate text-base leading-[1.45] font-semibold", isMe ? "text-brand-soft-fg" : "text-fg")}
      >
        {isMe ? t("interactivePlay.you") : participant.name}
      </span>
      {typeof move === "number" && move !== 0 ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 text-sm leading-none font-semibold tabular-nums",
            move > 0 ? "text-success-fg" : "text-fg-muted",
          )}
        >
          {/* Direction in words for screen readers ("ขึ้นมา 2 อันดับ"), not only the arrow and colour. */}
          <span className="sr-only">
            {`${t(move > 0 ? "interactivePlay.rankUpPrefix" : "interactivePlay.rankDownPrefix")} ${Math.abs(move)} ${t("interactivePlay.rankMoveUnit")}`}
          </span>
          {move > 0 ? (
            <ArrowUp aria-hidden="true" className="size-4" strokeWidth={2.6} />
          ) : (
            <ArrowDown aria-hidden="true" className="size-4" strokeWidth={2.6} />
          )}
          <span aria-hidden="true">{Math.abs(move)}</span>
        </span>
      ) : null}
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-base leading-none font-semibold text-fg tabular-nums">{score}</span>
        <span className="mt-0.5 text-xs leading-[1.5] text-fg-muted">{t("interactivePlay.pointsUnit")}</span>
      </span>
    </li>
  );
}

/**
 * Class ranking during the live lesson (and the final results on wrap-up),
 * components.md §6.4: a card with "อันดับตอนนี้" + "คุณอันดับ n"; 56px rows
 * (LeaderboardRow). `show="focus"` (the spec's in-lesson view) keeps the top 3
 * plus your row, with a "…" row between when you are below 4th; `show="all"`
 * (default, unchanged behaviour for existing screens) lists everyone.
 * Server-compatible.
 */
export function MobileLeaderboard({ participants, studentId, title, show = "all" }: {
  participants: LeaderboardParticipant[];
  studentId: string;
  /** Defaults to "อันดับตอนนี้". */
  title?: string;
  show?: "focus" | "all";
}) {
  const { entries, myRank, myScore } = rankParticipants(participants, studentId);
  if (entries.length === 0) return null;
  const heading = title ?? t("interactivePlay.leaderboardTitle");

  const myIndex = entries.findIndex((entry) => entry.isMe);
  // "focus": top 3, plus your row (4th joins directly; 5th or lower after a "…" row).
  const focused = show === "focus" && myIndex > PODIUM_ROWS;
  const visible =
    show === "all"
      ? entries
      : focused
        ? [...entries.slice(0, PODIUM_ROWS), entries[myIndex]]
        : entries.slice(0, myIndex === PODIUM_ROWS ? PODIUM_ROWS + 1 : PODIUM_ROWS);

  return (
    <section
      aria-label={heading}
      className="w-full overflow-hidden rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface pt-1.5 shadow-[var(--shadow-card)]"
    >
      <div className="flex min-h-11 items-center justify-between gap-2 px-4 pt-1 pb-1.5">
        <h3 className="font-heading text-base leading-[1.45] font-semibold text-fg">{heading}</h3>
        {myRank > 0 && myScore > 0 ? (
          <Chip tone="brand" size="md">
            {t("interactivePlay.youRankPrefix")} <span className="font-sans tabular-nums">{myRank}</span>
          </Chip>
        ) : null}
      </div>
      <ol className="list-none">
        {visible.map(({ participant, rank, score, isMe, medal }, index) => {
          const showGap = focused && index === PODIUM_ROWS;
          return [
            showGap ? <LeaderboardGap key="gap" /> : null,
            <LeaderboardRow
              key={participant.studentId || `row-${index}`}
              participant={participant}
              rank={rank}
              score={score}
              isMe={isMe}
              medal={medal}
              divider={index > 0 || showGap}
            />,
          ];
        })}
      </ol>
    </section>
  );
}
