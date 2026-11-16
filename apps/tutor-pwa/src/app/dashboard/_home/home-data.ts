/**
 * Pure helpers for the dashboard home (overview) page. Kept free of React and
 * fetch so they can be unit-tested (home-data.test.ts).
 */

import type { Tone } from "@/components/app";
import { t } from "@/lib/i18n";
import { classSetupHref } from "@/lib/tutorClassFlow";

/** Subset of finance `/v1/tutors/earnings/summary` used by the home page. */
export interface FinanceSummary {
  currentRate: number;
  grossVolumeTHB: number;
  nextTierTargetTHB?: number | null;
  estimatedCommissionTHB?: number | null;
  /** The tutor's own sales this month, in baht. */
  personalVolumeTHB?: number | null;
  /** This month's network bonus (payout minus rate x own sales), in baht. */
  networkBonusTHB?: number | null;
}

/** Subset of learning `/v1/dashboard/summary` (tutor branch). */
export interface LearningSummary {
  openClasses?: number;
  totalStudents?: number;
  classesThisWeek?: number;
  recentClasses?: RecentClass[];
  classesNeedingSetup?: ClassNeedingSetup[];
}

export interface RecentClass {
  id: string;
  name: string;
  status: string;
  students: number;
  nextSession: string;
}

/** A class an admin created for this tutor that still needs a schedule and meeting link. */
export interface ClassNeedingSetup {
  classId: string;
  title: string;
  bookTitle: string | null;
  /** Students with an ACTIVE (paid) enrollment. */
  activeStudents: number;
  setupRequiredAt: string;
}

/**
 * Right after sign-in (`/dashboard?signedIn=1`, set by the OAuth callback)
 * the tutor lands on the first class waiting for setup, if any.
 */
export function signInSetupRedirect(
  signedIn: string | string[] | undefined,
  classes: ClassNeedingSetup[] | null | undefined,
): string | null {
  if (signedIn !== "1") return null;
  const first = classes?.[0];
  return first ? classSetupHref(first.classId) : null;
}

/** One line of the dashboard setup notice. */
export function setupNoticeLine(cls: Pick<ClassNeedingSetup, "title" | "activeStudents">): string {
  return `"${cls.title}" · ${t("dashboardHome.setupNoticePaidPrefix")} ${cls.activeStudents} ${t("dashboardHome.studentsUnit")} — ${t("dashboardHome.setupNoticeAction")}`;
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

/** Which sentence explains the wallet amount on Home. */
export type WalletBreakdown =
  | { kind: "solo" }
  | { kind: "network"; personalVolume: number; networkBonus: number }
  | { kind: "unknown" };

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * The wallet sub-line is chosen from data, display only:
 * - no finance data, or personal volume / network bonus missing → unknown (no sub-line)
 * - group volume above the tutor's own volume (the downline sold) → network
 * - otherwise → solo (the rate and the accumulated volume).
 * Decided on volumes, not on the bonus: a downline-only month has bonus 0.
 */
export function computeWalletBreakdown(finance: FinanceSummary | null | undefined): WalletBreakdown {
  if (!finance) return { kind: "unknown" };
  const { personalVolumeTHB, networkBonusTHB } = finance;
  if (!isFiniteNumber(personalVolumeTHB) || !isFiniteNumber(networkBonusTHB)) return { kind: "unknown" };
  if (finance.grossVolumeTHB > personalVolumeTHB) {
    return { kind: "network", personalVolume: personalVolumeTHB, networkBonus: networkBonusTHB };
  }
  return { kind: "solo" };
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
