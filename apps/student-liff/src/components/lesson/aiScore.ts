// AI score presentation (score out of 5) shared by the live lesson phases.

export type AiScoreTone = "success" | "warning" | "danger";

/** Colour family of an AI score out of 5 (same thresholds as before: ≥4 good, ≥2 okay). */
export function getAiScoreTone(score: number): AiScoreTone {
  return score >= 4 ? "success" : score >= 2 ? "warning" : "danger";
}

/** "⭐⭐⭐" for a score out of 5 (rounded, never negative). */
export function getScoreStars(score: number): string {
  return "⭐".repeat(Math.max(0, Math.round(score)));
}
