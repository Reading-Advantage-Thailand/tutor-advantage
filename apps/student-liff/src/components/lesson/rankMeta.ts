// Rank presentation shared by lesson history, the live leaderboard and the
// wrap-up screen. Relative imports only: vitest maps "@" to another app.
import { t } from "../../lib/i18n";
import type { IconTileTone } from "../mobile/IconTile";
import type { ConfettiIntensity } from "../celebrate/confettiModel";

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

export type WrapUpTier =
  | "champion" // rank 1 with a score
  | "podium" // rank 2–3 with a score
  | "upperHalf" // top half of the class
  | "keepGoing" // lower half: encouraging, never shaming
  | "allTied" // everyone has the same (non-zero) score
  | "noScore" // finished with 0 points while others scored
  | "noScoresYet" // nobody scored this time
  | "unranked"; // not in the participant list

export interface WrapUpCelebration {
  tier: WrapUpTier;
  emoji: string;
  title: string;
  subtitle: string;
  /** Finishing the lesson always gets a small burst; "big" is for real podium places. */
  confetti: ConfettiIntensity;
}

export interface WrapUpInput {
  /** Shared (competition) rank; 0 when not ranked. */
  rank: number;
  score: number;
  /** Class size. */
  total: number;
  /** The student's rank is shared with someone else. */
  tied?: boolean;
  /** Two or more players, all with the same score. */
  allTied?: boolean;
}

function rankLine(rank: number, total: number, tied: boolean): string {
  const base =
    total > 0
      ? `${t("interactivePlay.rankPrefix")} ${rank} ${t("interactivePlay.rankFrom")} ${total} ${t("interactivePlay.personUnit")}`
      : `${t("interactivePlay.rankPrefix")} ${rank}`;
  return tied ? `${base} · ${t("interactivePlay.wrapUpTiedNote")}` : base;
}

/**
 * Hero copy + confetti for the live-lesson wrap-up. Kind at every tier: the
 * "winner" wording and the big burst only go to students who placed 1–3 with
 * a real score; everyone else still gets a small celebration for finishing.
 */
export function getWrapUpCelebration({ rank, score, total, tied = false, allTied = false }: WrapUpInput): WrapUpCelebration {
  const r = Number.isFinite(rank) && rank > 0 ? Math.floor(rank) : 0;
  const s = Number.isFinite(score) ? score : 0;
  if (r === 0) {
    return { tier: "unranked", emoji: "🎉", title: t("interactivePlay.wrapUpUnrankedTitle"), subtitle: t("interactivePlay.wrapUpUnrankedSubtitle"), confetti: "small" };
  }
  if (s <= 0) {
    // allTied with a 0 score means nobody in the class scored.
    const nobody = allTied || total <= 1;
    return {
      tier: nobody ? "noScoresYet" : "noScore",
      emoji: "🌱",
      title: t("interactivePlay.wrapUpNoScoreTitle"),
      subtitle: t(nobody ? "interactivePlay.wrapUpNoScoresYetSubtitle" : "interactivePlay.wrapUpNoScoreSubtitle"),
      confetti: "small",
    };
  }
  if (allTied) {
    return { tier: "allTied", emoji: "🤝", title: t("interactivePlay.wrapUpAllTiedTitle"), subtitle: t("interactivePlay.wrapUpAllTiedSubtitle"), confetti: "medium" };
  }
  const subtitle = rankLine(r, total, tied);
  if (r === 1) {
    return {
      tier: "champion",
      emoji: "🏆",
      title: tied ? t("interactivePlay.wrapUpChampionTiedTitle") : t("interactivePlay.rankFirst"),
      subtitle,
      confetti: "big",
    };
  }
  if (r <= 3) {
    return { tier: "podium", emoji: PODIUM[r].emoji, title: getRankMeta(r).title, subtitle, confetti: "big" };
  }
  if (total > 0 && r <= Math.ceil(total / 2)) {
    return { tier: "upperHalf", emoji: "🌟", title: t("interactivePlay.greatJob"), subtitle, confetti: "medium" };
  }
  return { tier: "keepGoing", emoji: "💪", title: t("interactivePlay.wrapUpKeepGoingTitle"), subtitle: t("interactivePlay.wrapUpKeepGoingSubtitle"), confetti: "small" };
}

/** "2/4" when the class size is known (> 0), otherwise just "2". */
export function formatRankOf(rank: number, total: number | null | undefined): string {
  return typeof total === "number" && total > 0 ? `${rank}/${total}` : String(rank);
}
