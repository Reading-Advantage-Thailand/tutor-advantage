// Rank presentation shared by lesson history, the live leaderboard and the
// wrap-up screen. Relative imports only: vitest maps "@" to another app.
import { t } from "../../lib/i18n";
import type { IconTileTone } from "../mobile/IconTile";

export interface RankMeta {
  /** Normalised rank; 0 when there is no valid rank. */
  rank: number;
  hasRank: boolean;
  /** Medal for the top three, otherwise null (show the number instead). */
  emoji: string | null;
  /** Colour family for tiles/chips. */
  tone: IconTileTone;
  /** Short label, e.g. "อันดับ 2"; "" without a rank. */
  label: string;
  /** Celebration headline for the final lesson screen. */
  title: string;
}

const PODIUM: Record<number, { emoji: string; tone: IconTileTone }> = {
  1: { emoji: "🥇", tone: "amber" },
  2: { emoji: "🥈", tone: "blue" },
  3: { emoji: "🥉", tone: "pink" },
};

export function getRankMeta(rank: number | null | undefined): RankMeta {
  const value = typeof rank === "number" && Number.isFinite(rank) && rank > 0 ? Math.floor(rank) : 0;
  const podium = PODIUM[value];
  const title =
    value === 1
      ? t("interactivePlay.rankFirst")
      : value === 2
        ? t("interactivePlay.rankSecond")
        : value === 3
          ? t("interactivePlay.rankThird")
          : t("interactivePlay.greatJob");
  return {
    rank: value,
    hasRank: value > 0,
    emoji: podium?.emoji ?? null,
    tone: podium?.tone ?? "neutral",
    label: value > 0 ? `${t("lessonHistory.rankLabel")} ${value}` : "",
    title,
  };
}

/** "2/4" when the class size is known (> 0), otherwise just "2". */
export function formatRankOf(rank: number, total: number | null | undefined): string {
  return typeof total === "number" && total > 0 ? `${rank}/${total}` : String(rank);
}
