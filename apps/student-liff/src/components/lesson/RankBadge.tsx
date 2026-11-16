import { cn } from "@/lib/utils";
import { getRankMeta } from "./rankMeta";

const sizeClass = {
  sm: "size-9 text-base",
  md: "size-10 text-base",
  lg: "size-12 text-lg",
} as const;

/**
 * Rank cell (components.md §6.4). Ranks 1–3 (with `medal`) are round medal
 * discs in --medal-gold / silver / bronze with an --on-medal numeral and a soft
 * inner bottom shade; other ranks are a plain numeral (`plain`, leaderboard
 * rows) or a neutral disc (`tile`, list leading slots). "–" before a first
 * score. Numerals use the reading face with tabular figures. The accessible
 * name is "อันดับ n". Server-compatible.
 */
export function RankBadge({ rank, medal = true, size = "md", variant = "tile", className }: {
  rank: number | null | undefined;
  /** Allow a podium medal for ranks 1–3 (default true). */
  medal?: boolean;
  /** sm 36 · md 40 · lg 48 */
  size?: keyof typeof sizeClass;
  /** tile (default): neutral disc for ranks without a medal · plain: just the numeral. */
  variant?: "tile" | "plain";
  className?: string;
}) {
  const meta = getRankMeta(rank);
  const podium = medal && meta.hasRank && meta.rank <= 3;
  return (
    <span
      role={meta.hasRank ? "img" : undefined}
      aria-label={meta.hasRank ? meta.label : undefined}
      aria-hidden={meta.hasRank ? undefined : true}
      data-medal={podium ? meta.rank : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none font-semibold tabular-nums",
        sizeClass[size],
        podium
          ? "medal-disc"
          : variant === "plain"
            ? "text-fg-muted"
            : "bg-tile-neutral text-icon-neutral",
        className,
      )}
    >
      <span aria-hidden="true">{meta.hasRank ? meta.rank : "–"}</span>
    </span>
  );
}
