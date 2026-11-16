import { UserAvatar } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { RankedEntry } from "./leaderboardModel";

interface PodiumParticipant {
  studentId: string;
  name: string;
  pictureUrl?: string;
}

/** Block height and medal colour per shared rank (components.md §6.5: 88 / 64 / 48). */
const BLOCK: Record<number, string> = {
  1: "h-[88px] bg-medal-gold",
  2: "h-16 bg-medal-silver",
  3: "h-12 bg-medal-bronze",
};

/** Visual order 2 · 1 · 3 (the list order stays 1 · 2 · 3 for screen readers). */
const ORDER = ["order-2", "order-1", "order-3"] as const;

/**
 * Wrap-up podium: the scoring top three, each with avatar, name, "N คะแนน"
 * (reading face, tabular) and a gold / silver / bronze block holding the
 * Kodchasan 700 numeral. Ties share a rank (and a block height). Renders
 * nothing when nobody has scored. Server-compatible.
 */
export function Podium<T extends PodiumParticipant>({ entries, className }: { entries: RankedEntry<T>[]; className?: string }) {
  const top = entries.slice(0, 3).filter((entry) => entry.medal);
  if (top.length === 0) return null;
  return (
    <ol className={cn("flex list-none items-end justify-center gap-2.5", className)}>
      {top.map(({ participant, rank, score, isMe }, index) => {
        const name = isMe ? t("interactivePlay.you") : participant.name;
        return (
          <li
            key={participant.studentId || index}
            aria-current={isMe ? "true" : undefined}
            className={cn("flex w-[31%] max-w-[148px] min-w-0 flex-col items-center", ORDER[index])}
          >
            <span className="sr-only">{`${t("lessonHistory.rankLabel")} ${rank}`}</span>
            <UserAvatar src={participant.pictureUrl} name={participant.name || "?"} size="md" ring={isMe ? "you" : "surface"} decorative />
            <span
              title={isMe ? undefined : participant.name}
              className={cn("mt-1.5 w-full truncate text-center text-[15px] leading-[1.45] font-semibold", isMe ? "text-brand-fg" : "text-fg")}
            >
              {name}
            </span>
            <span className="text-[13px] leading-[1.5] text-fg-muted">
              <span className="font-semibold text-fg tabular-nums">{score}</span> {t("interactivePlay.pointsUnit")}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "mt-2 flex w-full justify-center rounded-t-[16px] pt-2.5 font-heading text-[28px] leading-none font-bold text-on-medal shadow-[inset_0_-3px_0_rgb(0_0_0/0.12)]",
                BLOCK[rank] ?? BLOCK[3],
              )}
            >
              {rank}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
