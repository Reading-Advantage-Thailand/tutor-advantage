/**
 * Pure helpers for the performance page (tested in performance-data.test.ts).
 */

import type { TileTone, Tone } from "@/components/app";

export type MetricSource = "actual" | "historical" | "unavailable";

export type MetricValue = {
  value: number | null;
  source: MetricSource;
  sampleSize: number;
};

export type StudentBenchmark = MetricValue & {
  current: number | null;
  target: number;
  level: string;
  correctAnswers: number | null;
  totalAnswers: number | null;
};

export type PerformanceBadge = {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  unlockedAt: string;
};

export type NextGoal = {
  code: string;
  label: string;
  description: string;
  icon: string;
  progress: number;
};

export type PerformanceActivity = {
  completedClasses?: number;
  completedHours?: number;
  interactiveSessions?: number;
  referralCount?: number;
  reviews?: { total?: number; average?: number | null };
  answers?: { total?: number; correct?: number };
};

export type PerformanceData = {
  metrics?: {
    studentBenchmark?: StudentBenchmark;
    engagement?: {
      responseTimeMinutes?: MetricValue;
      rating?: MetricValue;
      completedClasses?: number;
    };
    activity?: PerformanceActivity;
  };
  badges?: {
    unlocked?: PerformanceBadge[];
    nextGoal?: NextGoal | null;
  };
};

export function numberOrZero(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function metricValue(metric: MetricValue | undefined): number | null {
  return typeof metric?.value === "number" ? metric.value : null;
}

/** Chip tone per metric source. */
export const sourceTone: Record<MetricSource, Tone> = {
  actual: "success",
  historical: "warning",
  unavailable: "neutral",
};

/** True when the API returned anything worth showing beyond the hero stats. */
export function hasPerformanceSignal(data: PerformanceData | null | undefined): boolean {
  if (!data) return false;
  const metrics = data.metrics;
  const activity = metrics?.activity;
  const hasMetricData =
    typeof metrics?.studentBenchmark?.current === "number" ||
    metricValue(metrics?.engagement?.rating) !== null ||
    metricValue(metrics?.engagement?.responseTimeMinutes) !== null;
  const hasActivityData =
    numberOrZero(activity?.completedClasses) > 0 ||
    numberOrZero(activity?.completedHours) > 0 ||
    numberOrZero(activity?.interactiveSessions) > 0 ||
    numberOrZero(activity?.referralCount) > 0 ||
    numberOrZero(activity?.reviews?.total) > 0 ||
    numberOrZero(activity?.answers?.total) > 0;
  return hasMetricData || hasActivityData || (data.badges?.unlocked?.length ?? 0) > 0 || Boolean(data.badges?.nextGoal);
}

export interface TierProgress {
  /** Previous tier threshold (THB). */
  prevTier: number;
  /** Threshold being worked towards (or the current one at max tier). */
  target: number;
  /** 0–100 progress from `prevTier` to `target`. */
  progress: number;
  remaining: number;
  isMaxTier: boolean;
}

/** Commission tier thresholds (THB) used by the finance service. */
export const TIER_THRESHOLDS = [20_000, 100_000, 500_000] as const;

/**
 * Progress from the previous commission tier to the next one. Same maths as the
 * previous inline implementation: tiers at 20k / 100k / 500k, 100% when there
 * is no next tier.
 */
export function computeTierProgress(grossVolume: number, nextTier: number): TierProgress {
  let prevTier = 0;
  for (const threshold of TIER_THRESHOLDS) if (grossVolume >= threshold) prevTier = threshold;
  const target = nextTier > 0 ? nextTier : prevTier || TIER_THRESHOLDS[0];
  const isMaxTier = nextTier <= 0;
  const progress =
    isMaxTier || target === prevTier
      ? 100
      : Math.min(100, Math.max(0, Math.round(((grossVolume - prevTier) / (target - prevTier)) * 100)));
  return { prevTier, target, progress, remaining: Math.max(0, target - grossVolume), isMaxTier };
}

const BADGE_HUES: Array<[RegExp, TileTone]> = [
  [/\b(?:text|bg)-(?:amber|yellow)-/, "amber"],
  [/\b(?:text|bg)-orange-/, "orange"],
  [/\b(?:text|bg)-(?:emerald|green|lime|brand)-/, "brand"],
  [/\b(?:text|bg)-(?:teal|cyan)-/, "teal"],
  [/\b(?:text|bg)-(?:blue|sky|indigo)-/, "blue"],
  [/\b(?:text|bg)-(?:violet|purple|fuchsia)-/, "purple"],
  [/\b(?:text|bg)-(?:pink|rose)-/, "pink"],
  [/\b(?:text|bg)-red-/, "red"],
];

/**
 * The API sends Tailwind classes per badge ("bg-amber-100 text-amber-600"),
 * which are not in our source (so not generated) and off-palette. Map the hue
 * to a design-system tile tone instead.
 */
export function badgeTone(color: string | null | undefined): TileTone {
  if (!color) return "amber";
  for (const [pattern, tone] of BADGE_HUES) if (pattern.test(color)) return tone;
  return "neutral";
}
