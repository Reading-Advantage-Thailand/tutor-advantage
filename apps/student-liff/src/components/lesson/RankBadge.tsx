import { iconTileToneClass } from "@/components/mobile";
import { cn } from "@/lib/utils";
import { getRankMeta } from "./rankMeta";

const sizeClass = {
  sm: { box: "size-8 rounded-[10px]", emoji: "text-lg", number: "text-[13px]" },
  md: { box: "size-10 rounded-xl", emoji: "text-[22px]", number: "text-[15px]" },
  lg: { box: "size-12 rounded-[14px]", emoji: "text-[28px]", number: "text-lg" },
} as const;

/**
 * Medal (top three) or "#n" tile for a rank; "–" when there is no rank.
 * Pass `medal={false}` to show the plain number even on the podium (e.g. a
 * 0-point row). The accessible name is "อันดับ n". Server-compatible.
 */
export function RankBadge({ rank, medal = true, size = "md", className }: {
  rank: number | null | undefined;
  /** Allow a podium medal for ranks 1–3 (default true). */
  medal?: boolean;
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  const ranked = getRankMeta(rank);
  const meta = medal ? ranked : { ...ranked, emoji: null, tone: "neutral" as const };
  const s = sizeClass[size];
  return (
    <span
      role={meta.hasRank ? "img" : undefined}
      aria-label={meta.hasRank ? meta.label : undefined}
      aria-hidden={meta.hasRank ? undefined : true}
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none font-extrabold tabular-nums",
        s.box,
        iconTileToneClass[meta.tone],
        className,
      )}
    >
      {meta.emoji ? (
        <span aria-hidden="true" className={s.emoji}>{meta.emoji}</span>
      ) : (
        <span aria-hidden="true" className={s.number}>{meta.hasRank ? `#${meta.rank}` : "–"}</span>
      )}
    </span>
  );
}
