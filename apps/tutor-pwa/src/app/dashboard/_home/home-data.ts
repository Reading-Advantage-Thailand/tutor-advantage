/**
 * Pure helpers for the dashboard home (overview) page. Kept free of React and
 * fetch so they can be unit-tested (home-data.test.ts).
 */

import type { Tone } from "@/components/app";

/** Subset of finance `/v1/tutors/earnings/summary` used by the home page. */
export interface FinanceSummary {
  currentRate: number;
  grossVolumeTHB: number;
  nextTierTargetTHB?: number | null;
  estimatedCommissionTHB?: number | null;
}

/** Subset of learning `/v1/dashboard/summary` (tutor branch). */
export interface LearningSummary {
  openClasses?: number;
  totalStudents?: number;
  classesThisWeek?: number;
  recentClasses?: RecentClass[];
}

export interface RecentClass {
  id: string;
  name: string;
  status: string;
  students: number;
  nextSession: string;
}

/** Default target when finance data is missing (matches the previous UI). */
export const DEFAULT_RATE_TARGET_THB = 20_000;

export type RateGoalState = "max" | "reached" | "progress";

export interface RateGoal {
  /** Commission rate ratio (0.43 = 43%). */
  rate: number;
  grossVolume: number;
  target: number;
  /** 0–100 progress towards `target`. */
  progress: number;
  /** Baht still needed to reach `target` (only meaningful for "progress"). */
  remaining: number;
  state: RateGoalState;
}

/**
 * Next-rate goal shown on Home. Mirrors the previous inline logic:
 * - no finance data → 0% progress towards the default 20,000 target
 * - target ≤ 0 → already at the max rate
 * - otherwise progress = GV / target, capped at 100.
 */
export function computeRateGoal(finance: FinanceSummary | null | undefined): RateGoal {
  const target = finance?.nextTierTargetTHB ?? DEFAULT_RATE_TARGET_THB;
  const grossVolume = finance?.grossVolumeTHB ?? 0;
  const rate = finance?.currentRate ?? 0;
  const progress = finance
    ? target > 0
      ? Math.min(100, Math.max(0, Math.round((grossVolume / target) * 100)))
      : 100
    : 0;
  const state: RateGoalState = target <= 0 ? "max" : progress >= 100 ? "reached" : "progress";
  const remaining = Math.max(0, finance ? target - grossVolume : target);
  return { rate, grossVolume, target, progress, remaining, state };
}

/** Class status (lower-cased from the API) → Thai label key + chip tone. */
export function classStatusTone(status: string | null | undefined): {
  key: "open" | "full" | "closed";
  tone: Tone;
} {
  switch ((status ?? "").toLowerCase()) {
    case "open":
      return { key: "open", tone: "success" };
    case "full":
      return { key: "full", tone: "warning" };
    default:
      return { key: "closed", tone: "neutral" };
  }
}
