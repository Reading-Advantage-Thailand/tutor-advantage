import { createHash } from "crypto";
import { prisma } from "@tutor-advantage/database";
import { Prisma } from "@prisma/client";
import {
  calculateCommissionInfo,
  calculatePayoutMinor,
  getIctMonthWindow,
} from "./commissionService";
import {
  buildPayoutDocumentNumber,
  calculateWithholdingTax,
} from "./taxService";
import {
  createOmiseTransfer,
  listOmiseTransfers,
  retrieveOmiseTransfer,
  isOmiseConfigured,
  type OmiseTransfer,
} from "./omiseService";

export interface PayoutNode {
  userId: string;
  sponsorId: string | null;
  personalVolumeMinor: bigint;
  groupVolumeMinor: bigint;
  payoutRate: number;
  payoutAmountMinor: bigint;
  eligibilityStatus: string;
  verified: boolean;
  payoutIdentityVersion: number;
  recipientId: string | null;
}

// Badge records are currently lifetime achievements without a period-scoped,
// audited award ledger. They must not create cash liabilities until Finance
// can prove the qualifying activity for the current settlement period.
const BADGE_CASH_BONUS_ENABLED = false;

function isRefundAdjustment(reason: string) {
  return /(refund|chargeback)/i.test(reason);
}

function getOmiseRecipientId(settings: unknown) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }
  const recipientId = (settings as { omiseRecipientId?: unknown }).omiseRecipientId;
  return typeof recipientId === "string" && recipientId.trim()
    ? recipientId.trim()
    : null;
}

function transferStatusFromOmise(transfer: OmiseTransfer) {
  if (transfer.failure_code) return "TRANSFER_FAILED";
  if (transfer.paid) return "PAID";
  if (transfer.sent) return "SENT";
  if (transfer.sendable) return "SENT_PENDING";
  return "CREATED";
}

function hasActiveTransferStatus(status?: string | null) {
  return ["PENDING_TRANSFER", "CREATED", "SENT_PENDING", "SENT", "PAID"].includes(
    status ?? "",
  );
}

async function updatePayoutTransferTracking(
  payoutLineId: string,
  data: {
    provider?: string | null;
    providerTransferId?: string | null;
    transferStatus: string;
    transferFailureCode?: string | null;
    transferFailureMessage?: string | null;
    transferredAt?: Date | null;
  },
) {
  await prisma.$executeRaw`
    UPDATE "finance_mlm"."payout_documents"
    SET
      "provider" = ${data.provider ?? null},
      "provider_transfer_id" = CASE
        WHEN ${data.providerTransferId === undefined} THEN "provider_transfer_id"
        ELSE ${data.providerTransferId ?? null}
      END,
      "transfer_status" = ${data.transferStatus},
      "transfer_failure_code" = ${data.transferFailureCode ?? null},
      "transfer_failure_message" = ${data.transferFailureMessage ?? null},
      "transferred_at" = ${data.transferredAt ?? null}
    WHERE "payout_line_id" = ${payoutLineId}::uuid
  `;
}

function getTransferIdempotencyKey(payoutLineId: string) {
  return `omise:payout-line:${payoutLineId}`;
}

async function claimPayoutTransfer(payoutLineId: string) {
  const claimed = await prisma.payoutDocument.updateMany({
    where: {
      payoutLineId,
      transferStatus: { in: ["NOT_SENT", "TRANSFER_FAILED"] },
    },
    data: {
      provider: "omise",
      transferStatus: "PENDING_TRANSFER",
      transferFailureCode: null,
      transferFailureMessage: null,
      transferredAt: null,
    },
  });

  if (claimed.count !== 1) {
    throw new Error("TRANSFER_ALREADY_ACTIVE");
  }
}

async function recoverPayoutTransfer(payoutLineId: string) {
  const transfers = await listOmiseTransfers();
  const transfer = transfers.find(
    (candidate) => candidate.metadata?.payoutLineId === payoutLineId,
  );
  if (!transfer) return null;

  const transferStatus = transferStatusFromOmise(transfer);
  await updatePayoutTransferTracking(payoutLineId, {
    provider: "omise",
    providerTransferId: transfer.id,
    transferStatus,
    transferFailureCode: transfer.failure_code ?? null,
    transferFailureMessage: transfer.failure_message ?? null,
    transferredAt: transfer.paid_at
      ? new Date(transfer.paid_at)
      : transfer.sent_at
        ? new Date(transfer.sent_at)
        : null,
  });
  return transfer;
}

type PayoutIdentitySnapshot = {
  payoutLineId: string;
  tutorUserId: string;
  payoutIdentityVersion: number;
  recipientSnapshot: string | null;
};

function validatePayoutIdentitySnapshots(
  lines: PayoutIdentitySnapshot[],
  tutors: Array<{
    userId: string;
    isActive: boolean;
    verificationStatus: string;
    payoutIdentityVersion: number;
    settings: unknown;
  }>,
) {
  const tutorById = new Map(tutors.map((tutor) => [tutor.userId, tutor]));

  for (const line of lines) {
    const tutor = tutorById.get(line.tutorUserId);
    if (!tutor || !tutor.isActive || tutor.verificationStatus !== "VERIFIED") {
      throw new Error(`PAYOUT_ELIGIBILITY_CHANGED:${line.tutorUserId}`);
    }
    if (!line.recipientSnapshot) {
      throw new Error(`PAYOUT_IDENTITY_SNAPSHOT_MISSING:${line.tutorUserId}`);
    }
    if (tutor.payoutIdentityVersion !== line.payoutIdentityVersion) {
      throw new Error(`PAYOUT_IDENTITY_CHANGED:${line.tutorUserId}`);
    }
    if (getOmiseRecipientId(tutor.settings) !== line.recipientSnapshot) {
      throw new Error(`PAYOUT_IDENTITY_CHANGED:${line.tutorUserId}`);
    }
  }
}

/** One payout line as calculated (before it is persisted). */
export interface ComputedPayoutLine {
  tutorUserId: string;
  grossVolumeMinor: bigint;
  payoutRate: number;
  payoutAmountMinor: bigint;
  withholdingTaxMinor: bigint;
  netPayoutMinor: bigint;
  badgeBonusMinor: bigint;
  eligibilityStatus: string;
  payoutIdentityVersion: number;
  recipientSnapshot: string | null;
}

export interface ComputedSettlement {
  periodMonth: string;
  lines: ComputedPayoutLine[];
  paymentCount: number;
  approvedAdjustmentIds: string[];
  approvedAdjustmentTotalSatang: bigint;
  totalPayoutSatang: bigint;
  totalNetPayoutSatang: bigint;
}

/** Why a DRAFT/SUBMITTED run can no longer be submitted or approved as-is. */
export type SettlementStaleReason =
  | "NOT_PREVIEWED"
  | "LINES_CHANGED"
  | "ADJUSTMENTS_CHANGED";

export interface SettlementFreshness {
  /** The run has been calculated at least once (non-empty preview payload). */
  previewed: boolean;
  lineCount: number;
  stale: boolean;
  reasons: SettlementStaleReason[];
  /** Tutors whose payout line would differ if the run were recalculated now. */
  changedTutorUserIds: string[];
  checkedAt: string;
}

type FingerprintLine = {
  tutorUserId: string;
  grossVolumeMinor: bigint;
  payoutRate: unknown;
  payoutAmountMinor: bigint;
  withholdingTaxMinor: bigint;
  netPayoutMinor: bigint;
  badgeBonusMinor: bigint;
  eligibilityStatus: string;
  payoutIdentityVersion: number;
  recipientSnapshot: string | null;
};

function lineKey(line: FingerprintLine) {
  const rate = Number(String(line.payoutRate ?? 0));
  return [
    line.tutorUserId,
    line.grossVolumeMinor.toString(),
    Number.isFinite(rate) ? rate.toFixed(8) : String(line.payoutRate),
    line.payoutAmountMinor.toString(),
    line.withholdingTaxMinor.toString(),
    line.netPayoutMinor.toString(),
    line.badgeBonusMinor.toString(),
    line.eligibilityStatus,
    String(line.payoutIdentityVersion ?? 0),
    line.recipientSnapshot ?? "",
  ].join("|");
}

/** Stable hash of a set of payout lines (order independent). */
export function fingerprintPayoutLines(lines: FingerprintLine[]) {
  const keys = lines.map(lineKey).sort();
  return createHash("sha256").update(keys.join("\n")).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** A run counts as previewed once its payload carries calculation results. */
export function isPreviewedPayload(payload: unknown) {
  return Object.keys(asRecord(payload)).length > 0;
}

/**
 * Maker-checker bypass for local development only: an ADMIN may approve a
 * DRAFT directly. Requires an explicit opt-in (ENABLE_DEV_ROUTES=true) AND a
 * non-production NODE_ENV, so staging/preview deploys keep maker-checker.
 */
export function isDevMakerCheckerOverrideEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.ENABLE_DEV_ROUTES === "true" && env.NODE_ENV !== "production";
}

export class SettlementStaleError extends Error {
  constructor(public readonly freshness: SettlementFreshness) {
    super(`SETTLEMENT_STALE:${freshness.changedTutorUserIds.join(",")}`);
  }
}

export class SettlementService {
  /**
   * Calculates payout lines for a period WITHOUT writing anything. Used by
   * preview (which then persists the result) and by the freshness check that
   * guards submit/approve.
   * This calculation uses a Bottom-Up approach for a unilevel or differential tree.
   */
  static async computeSettlement(periodMonth: string): Promise<ComputedSettlement> {
    const { start: startOfMonth, end: endOfMonth } =
      getIctMonthWindow(periodMonth);

    const payments = await prisma.paymentIntent.findMany({
      where: {
        status: "SUCCESS",
        paidAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        events: true, // Used for more granular audit if needed
      },
    });

    // 2. Aggregate Personal Volume (PV) by student's class's tutor
    const tutorVolumes = new Map<string, bigint>();

    // To properly map to tutors, we need the enrollments for these payments
    // because PaymentIntent maps to the Student, but the money goes to the Tutor of the Class.
    const enrollmentIds = payments.map((p) => p.enrollmentId);

    const enrollments = await prisma.enrollment.findMany({
      where: { enrollmentId: { in: enrollmentIds } },
      include: { class: true },
    });

    const enrollmentTutorMap = new Map<string, string>();
    for (const enr of enrollments) {
      enrollmentTutorMap.set(enr.enrollmentId, enr.class.tutorUserId);
    }

    for (const payment of payments) {
      // Successful payments keep their earning owner. Fall back to the
      // enrollment's current class owner only for pre-migration payments.
      const tutorId = payment.earningTutorUserId ?? enrollmentTutorMap.get(payment.enrollmentId);
      if (!tutorId) continue;

      const currentVol = tutorVolumes.get(tutorId) || 0n;
      tutorVolumes.set(tutorId, currentVol + payment.amountMinor);
    }

    const approvedAdjustments = await prisma.adjustment.findMany({
      where: {
        status: "APPROVED",
        settlementRun: {
          periodMonth,
        },
      },
      select: {
        adjustmentId: true,
        tutorUserId: true,
        amountMinor: true,
        volumeMinor: true,
        reason: true,
      },
    });

    const adjustmentTotals = new Map<string, bigint>();
    const volumeAdjustmentTotals = new Map<string, bigint>();
    for (const adjustment of approvedAdjustments) {
      adjustmentTotals.set(
        adjustment.tutorUserId,
        (adjustmentTotals.get(adjustment.tutorUserId) || 0n) +
          adjustment.amountMinor,
      );

      if (isRefundAdjustment(adjustment.reason)) {
        const volumeMinor = adjustment.volumeMinor ?? adjustment.amountMinor;
        volumeAdjustmentTotals.set(
          adjustment.tutorUserId,
          (volumeAdjustmentTotals.get(adjustment.tutorUserId) || 0n) + volumeMinor,
        );
      }
    }

    for (const [tutorUserId, volumeDelta] of volumeAdjustmentTotals) {
      const currentVolume = tutorVolumes.get(tutorUserId) || 0n;
      tutorVolumes.set(tutorUserId, currentVolume + volumeDelta < 0n
        ? 0n
        : currentVolume + volumeDelta);
    }

    // 3. Build the organizational tree to calculate Group Volume (GV) and Payouts
    // For a real MLM tree, we need the upline structure.
    // Load the complete sponsor graph. Active tutors whose sponsor is inactive
    // must be compressed to the nearest active ancestor (or become a root),
    // otherwise filtering inactive sponsors out makes the whole subtree
    // unreachable and silently drops its payout.
    const allUsers = await prisma.user.findMany({
      where: { role: "TUTOR" },
      select: {
        userId: true,
        sponsorTutorId: true,
        isActive: true,
        verificationStatus: true,
        settings: true,
        payoutIdentityVersion: true,
      },
    });

    const userById = new Map(allUsers.map((user) => [user.userId, user]));

    const resolveEffectiveSponsor = (userId: string) => {
      const visited = new Set<string>([userId]);
      let sponsorId = userById.get(userId)?.sponsorTutorId ?? null;

      while (sponsorId) {
        const sponsor = userById.get(sponsorId);
        if (!sponsor) throw new Error(`SPONSOR_NOT_FOUND:${sponsorId}`);
        if (visited.has(sponsorId)) throw new Error("SPONSOR_TREE_CYCLE");
        visited.add(sponsorId);
        if (sponsor.isActive !== false) return sponsorId;
        sponsorId = sponsor.sponsorTutorId;
      }

      return null;
    };

    const nodes = new Map<string, PayoutNode>();
    for (const u of allUsers.filter((user) => user.isActive !== false)) {
      nodes.set(u.userId, {
        userId: u.userId,
        sponsorId: resolveEffectiveSponsor(u.userId),
        personalVolumeMinor: tutorVolumes.get(u.userId) || 0n,
        groupVolumeMinor: tutorVolumes.get(u.userId) || 0n, // Initially GV = PV
        payoutRate: 0,
        payoutAmountMinor: 0n,
        eligibilityStatus: "ELIGIBLE_BASE",
        verified: u.verificationStatus === "VERIFIED",
        payoutIdentityVersion: u.payoutIdentityVersion ?? 0,
        recipientId: getOmiseRecipientId(u.settings),
      });
    }

    for (const [tutorUserId] of adjustmentTotals) {
      if (!nodes.has(tutorUserId)) {
        nodes.set(tutorUserId, {
          userId: tutorUserId,
          sponsorId: null,
          personalVolumeMinor: 0n,
          groupVolumeMinor: 0n,
          payoutRate: 0,
          payoutAmountMinor: 0n,
          eligibilityStatus: "ADJUSTMENT_ONLY",
          verified: false, // no user record → treat as unverified
          payoutIdentityVersion: 0,
          recipientId: null,
        });
      }
    }

    // 4. Graph traversal for accurate GV and Payout calculation.
    // A malformed sponsor component must not cancel every other tutor's
    // settlement. Since each node has at most one sponsor, walking the sponsor
    // chain identifies both the cycle and any descendants that depend on it.
    const invalidSponsorNodes = new Set<string>();
    for (const startUserId of nodes.keys()) {
      const path: string[] = [];
      const pathIndex = new Map<string, number>();
      let currentUserId: string | null = startUserId;
      let cycleStart = -1;
      let reachedInvalidNode = false;

      while (currentUserId && nodes.has(currentUserId)) {
        if (invalidSponsorNodes.has(currentUserId)) {
          reachedInvalidNode = true;
          break;
        }

        const existingIndex = pathIndex.get(currentUserId);
        if (existingIndex !== undefined) {
          cycleStart = existingIndex;
          break;
        }

        pathIndex.set(currentUserId, path.length);
        path.push(currentUserId);
        currentUserId = nodes.get(currentUserId)!.sponsorId;
      }

      if (cycleStart >= 0 || reachedInvalidNode) {
        for (const userId of path) invalidSponsorNodes.add(userId);
      }
    }

    const childMap = new Map<string, string[]>();
    for (const node of nodes.values()) {
      if (
        node.sponsorId &&
        nodes.has(node.sponsorId) &&
        !invalidSponsorNodes.has(node.userId) &&
        !invalidSponsorNodes.has(node.sponsorId)
      ) {
        if (!childMap.has(node.sponsorId)) {
          childMap.set(node.sponsorId, []);
        }
        childMap.get(node.sponsorId)!.push(node.userId);
      }
    }

    for (const userId of invalidSponsorNodes) {
      const node = nodes.get(userId)!;
      node.groupVolumeMinor = node.personalVolumeMinor;
      node.payoutRate = 0;
      node.payoutAmountMinor = 0n;
      node.eligibilityStatus = "INELIGIBLE_SPONSOR_CYCLE";
    }

    // Recursive function to calculate GV bottom-up
    const calculateGV = (userId: string): bigint => {
      const node = nodes.get(userId)!;
      let totalGV = node.personalVolumeMinor;
      const children = childMap.get(userId) || [];
      for (const childId of children) {
        totalGV += calculateGV(childId);
      }
      node.groupVolumeMinor = totalGV;
      return totalGV;
    };

    // Find roots (users without sponsors) and calculate their trees
    for (const node of nodes.values()) {
      if (!node.sponsorId && !invalidSponsorNodes.has(node.userId)) {
        calculateGV(node.userId);
      }
    }

    const calculatePayouts = (userId: string, visiting = new Set<string>()) => {
      if (visiting.has(userId)) {
        throw new Error("SPONSOR_TREE_CYCLE");
      }
      visiting.add(userId);

      const node = nodes.get(userId)!;
      if (invalidSponsorNodes.has(userId)) return 0n;
      const myRate = calculateCommissionInfo(
        Number(node.groupVolumeMinor) / 100,
      ).rate;
      node.payoutRate = myRate;

      const children = childMap.get(userId) || [];
      let childPayouts = 0n;

      for (const childId of children) {
        childPayouts += calculatePayouts(childId, new Set(visiting));
      }

      let payoutForMe =
        calculatePayoutMinor(node.groupVolumeMinor, myRate) - childPayouts;

      if (payoutForMe < 0n) payoutForMe = 0n;

      if (node.personalVolumeMinor === 0n && children.length > 0) {
        node.eligibilityStatus = "INELIGIBLE_NO_PV";
        payoutForMe = 0n;
      } else if (payoutForMe > 0n) {
        node.eligibilityStatus = "ELIGIBLE";
      }

      node.payoutAmountMinor = payoutForMe;
      return payoutForMe;
    };

    // Find roots again and start the top-down payout calculation
    for (const node of nodes.values()) {
      if (!node.sponsorId && !invalidSponsorNodes.has(node.userId)) {
        calculatePayouts(node.userId);
      }
    }

    // Override: unverified tutors cannot receive payout regardless of calculated amount
    for (const node of nodes.values()) {
      if (!node.verified) {
        node.payoutAmountMinor = 0n;
        node.eligibilityStatus = "INELIGIBLE_NOT_VERIFIED";
      }
    }

    // Fetch badge bonuses for all tutors in this settlement
    // Badge bonus amounts in Satang — must match BadgeService.BADGE_BONUS_SATANG
    const BADGE_BONUS_SATANG: Record<string, bigint> = {
      ELITE_EDUCATOR:  50000n,
      TOP_RATED:       30000n,
      CLASS_MASTER:    20000n,
      NETWORK_BUILDER: 10000n,
      RISING_STAR:      5000n,
      FAST_RESPONDER:   5000n,
      AI_PIONEER:       5000n,
    };

    const tutorIds = Array.from(nodes.keys());
    const allBadges = await prisma.tutorBadge.findMany({
      where: { tutorUserId: { in: tutorIds } },
      select: { tutorUserId: true, badgeCode: true },
    });

    const badgeBonusMap = new Map<string, bigint>();
    for (const badge of allBadges) {
      const bonus = BADGE_BONUS_SATANG[badge.badgeCode] ?? 0n;
      badgeBonusMap.set(
        badge.tutorUserId,
        (badgeBonusMap.get(badge.tutorUserId) ?? 0n) + bonus,
      );
    }

    let totalPayoutSatang = 0n;
    let totalNetPayoutSatang = 0n;
    const lines: ComputedPayoutLine[] = [];
    for (const node of nodes.values()) {
      // Unverified tutors are blocked from ALL payouts — commission was already zeroed above.
      // Also block badge bonuses and adjustments so unverified tutors receive nothing.
      const effectiveAdjustment = node.verified
        ? (adjustmentTotals.get(node.userId) || 0n)
        : 0n;
      const effectiveBadgeBonus = BADGE_CASH_BONUS_ENABLED && node.verified
        ? (badgeBonusMap.get(node.userId) ?? 0n)
        : 0n;

      const adjustedPayoutMinor =
        node.payoutAmountMinor + effectiveAdjustment + effectiveBadgeBonus;

      // Include in payout lines if: has volume, has actual payout,
      // or had a BLOCKED adjustment (for audit visibility — shows adjustment was withheld)
      const blockedAdjustment = !node.verified
        ? (adjustmentTotals.get(node.userId) || 0n)
        : 0n;
      const hasActivity =
        adjustedPayoutMinor !== 0n ||
        node.groupVolumeMinor > 0n ||
        blockedAdjustment !== 0n;

      if (!hasActivity) continue;

      // BUSINESS RULE (pending owner decision, unchanged): a negative total
      // (clawback larger than earnings) is paid out as 0 with no WHT and no
      // carry-forward to the next period.
      const tax =
        adjustedPayoutMinor > 0n
          ? calculateWithholdingTax(adjustedPayoutMinor)
          : { withholdingTaxMinor: 0n, netPayoutMinor: 0n };

      totalPayoutSatang += adjustedPayoutMinor;
      totalNetPayoutSatang += tax.netPayoutMinor;

      // Only mark as _ADJUSTED if the tutor is verified and actually received extras
      const eligibilityStatus =
        node.verified && (effectiveAdjustment !== 0n || effectiveBadgeBonus !== 0n)
          ? `${node.eligibilityStatus}_ADJUSTED`
          : node.eligibilityStatus;

      lines.push({
        tutorUserId: node.userId,
        grossVolumeMinor: node.groupVolumeMinor,
        payoutRate: node.payoutRate,
        payoutAmountMinor: adjustedPayoutMinor,
        withholdingTaxMinor: tax.withholdingTaxMinor,
        netPayoutMinor: tax.netPayoutMinor,
        badgeBonusMinor: effectiveBadgeBonus,
        eligibilityStatus,
        payoutIdentityVersion: node.payoutIdentityVersion,
        recipientSnapshot: node.recipientId,
      });
    }

    return {
      periodMonth,
      lines,
      paymentCount: payments.length,
      approvedAdjustmentIds: approvedAdjustments
        .map((adjustment) => adjustment.adjustmentId)
        .filter((id): id is string => typeof id === "string")
        .sort(),
      approvedAdjustmentTotalSatang: approvedAdjustments.reduce(
        (sum, adjustment) => sum + adjustment.amountMinor,
        0n,
      ),
      totalPayoutSatang,
      totalNetPayoutSatang,
    };
  }

  /**
   * Calculates a period and persists it as the period's DRAFT run. All writes
   * (run row, old line/document removal, new lines) happen in ONE transaction,
   * so a run can never be left with a partial set of lines.
   */
  static async previewSettlement(
    periodMonth: string,
    createdBy: string,
    options?: { refreshRunId?: string },
  ) {
    // Validates the period (throws INVALID_PERIOD_MONTH).
    getIctMonthWindow(periodMonth);

    // There is one canonical run per period. Adjustment holders, rejected runs
    // and never-calculated (empty) drafts are refreshed in place;
    // approved/submitted runs and calculated drafts are not overwritten here.
    let effectiveRefreshRunId = options?.refreshRunId;
    let expectedStatus: string | null = null;
    let resetExistingRunToDraft = false;
    if (effectiveRefreshRunId) {
      const refreshRun = await prisma.settlementRun.findUnique({
        where: { settlementRunId: effectiveRefreshRunId },
        select: { status: true, periodMonth: true },
      });
      if (!refreshRun) throw new Error("NOT_FOUND");
      if (refreshRun.periodMonth !== periodMonth) {
        throw new Error("SETTLEMENT_PERIOD_MISMATCH");
      }
      if (!["DRAFT", "ADJUSTMENT_PENDING", "REJECTED", "REFRESHING"].includes(refreshRun.status)) {
        throw new Error("SETTLEMENT_IMMUTABLE");
      }
      expectedStatus = refreshRun.status;
      resetExistingRunToDraft = [
        "ADJUSTMENT_PENDING",
        "REJECTED",
        "REFRESHING",
      ].includes(refreshRun.status);
    }
    if (!effectiveRefreshRunId) {
      const existingRun = await prisma.settlementRun.findFirst({
        where: { periodMonth },
      });
      if (existingRun) {
        const isEmptyDraft =
          existingRun.status === "DRAFT" &&
          (!isPreviewedPayload(existingRun.previewPayload) ||
            (await prisma.payoutLine.count({
              where: { settlementRunId: existingRun.settlementRunId },
            })) === 0);
        if (["ADJUSTMENT_PENDING", "REJECTED"].includes(existingRun.status) || isEmptyDraft) {
          effectiveRefreshRunId = existingRun.settlementRunId;
          expectedStatus = existingRun.status;
          resetExistingRunToDraft = existingRun.status !== "DRAFT";
        } else {
          throw Object.assign(new Error("DRAFT_EXISTS"), {
            existingRunId: existingRun.settlementRunId,
            existingStatus: existingRun.status,
          });
        }
      }
    }

    const computed = await SettlementService.computeSettlement(periodMonth);
    const previewedAt = new Date().toISOString();
    const previewPayload = {
      paymentCount: computed.paymentCount,
      approvedAdjustmentCount: computed.approvedAdjustmentIds.length,
      approvedAdjustmentTotalSatang: computed.approvedAdjustmentTotalSatang.toString(),
      approvedAdjustmentIds: computed.approvedAdjustmentIds,
      payoutLineCount: computed.lines.length,
      totalPayoutSatang: computed.totalPayoutSatang.toString(),
      totalNetPayoutSatang: computed.totalNetPayoutSatang.toString(),
      linesFingerprint: fingerprintPayoutLines(computed.lines),
      previewedAt,
      previewedBy: createdBy,
      ...(effectiveRefreshRunId ? { refreshedAt: previewedAt } : {}),
    };

    // 6. Persist Draft Settlement Run, or refresh an existing active run.
    let run;
    try {
      run = await prisma.$transaction(async (tx) => {
        let persistedRun;
        if (effectiveRefreshRunId) {
          // Conditional claim: if anyone changed the run's status since we read
          // it (submit, approve, another refresh) nothing is overwritten.
          const claimed = await tx.settlementRun.updateMany({
            where: {
              settlementRunId: effectiveRefreshRunId,
              ...(expectedStatus ? { status: expectedStatus } : {}),
            },
            data: {
              previewPayload,
              ...(resetExistingRunToDraft ? { status: "DRAFT" } : {}),
            },
          });
          if (claimed.count !== 1) throw new Error("SETTLEMENT_ALREADY_CLAIMED");
          persistedRun = await tx.settlementRun.findUnique({
            where: { settlementRunId: effectiveRefreshRunId },
          });
          if (!persistedRun) throw new Error("NOT_FOUND");

          const existingLines = await tx.payoutLine.findMany({
            where: { settlementRunId: effectiveRefreshRunId },
            select: { payoutLineId: true },
          });
          const existingLineIds = existingLines.map((line) => line.payoutLineId);
          if (existingLineIds.length > 0) {
            await tx.payoutDocument.deleteMany({
              where: { payoutLineId: { in: existingLineIds } },
            });
          }
          await tx.payoutLine.deleteMany({
            where: { settlementRunId: effectiveRefreshRunId },
          });
        } else {
          persistedRun = await tx.settlementRun.create({
            data: {
              periodMonth,
              status: "DRAFT",
              createdBy,
              previewPayload,
            },
          });
        }

        if (computed.lines.length > 0) {
          await tx.payoutLine.createMany({
            data: computed.lines.map((line) => ({
              settlementRunId: persistedRun.settlementRunId,
              tutorUserId: line.tutorUserId,
              grossVolumeMinor: line.grossVolumeMinor,
              payoutRate: new Prisma.Decimal(line.payoutRate),
              payoutAmountMinor: line.payoutAmountMinor,
              withholdingTaxMinor: line.withholdingTaxMinor,
              netPayoutMinor: line.netPayoutMinor,
              badgeBonusMinor: line.badgeBonusMinor,
              eligibilityStatus: line.eligibilityStatus,
              payoutIdentityVersion: line.payoutIdentityVersion,
              recipientSnapshot: line.recipientSnapshot,
            })),
          });
        }
        return persistedRun;
      });
    } catch (error) {
      // The unique period constraint is the final guard for two previews that
      // race after both have passed the read-side idempotency check.
      if ((error as { code?: string }).code === "P2002") {
        throw new Error("DRAFT_EXISTS");
      }
      throw error;
    }

    return {
      snapshotId: run.settlementRunId,
      periodMonth,
      totalPayoutSatang: Number(computed.totalPayoutSatang),
      totalNetPayoutSatang: Number(computed.totalNetPayoutSatang),
      payoutLineCount: computed.lines.length,
      status: run.status,
    };
  }

  /**
   * Compares a DRAFT/SUBMITTED run with what a recalculation would produce
   * right now (payments, approved adjustments, tutor eligibility/identity).
   * Read-only.
   */
  static async getRunFreshness(run: {
    settlementRunId: string;
    periodMonth: string;
    previewPayload: unknown;
  }): Promise<SettlementFreshness> {
    const payload = asRecord(run.previewPayload);
    const previewed = isPreviewedPayload(payload);
    const [storedLines, computed] = await Promise.all([
      prisma.payoutLine.findMany({
        where: { settlementRunId: run.settlementRunId },
        select: {
          tutorUserId: true,
          grossVolumeMinor: true,
          payoutRate: true,
          payoutAmountMinor: true,
          withholdingTaxMinor: true,
          netPayoutMinor: true,
          badgeBonusMinor: true,
          eligibilityStatus: true,
          payoutIdentityVersion: true,
          recipientSnapshot: true,
        },
      }),
      SettlementService.computeSettlement(run.periodMonth),
    ]);

    const reasons: SettlementStaleReason[] = [];
    if (!previewed) reasons.push("NOT_PREVIEWED");

    const storedByTutor = new Map(storedLines.map((line) => [line.tutorUserId, lineKey(line)]));
    const computedByTutor = new Map(computed.lines.map((line) => [line.tutorUserId, lineKey(line)]));
    const changed = new Set<string>();
    for (const [tutorUserId, key] of storedByTutor) {
      if (computedByTutor.get(tutorUserId) !== key) changed.add(tutorUserId);
    }
    for (const tutorUserId of computedByTutor.keys()) {
      if (!storedByTutor.has(tutorUserId)) changed.add(tutorUserId);
    }
    if (changed.size > 0) reasons.push("LINES_CHANGED");

    if (previewed) {
      const storedIds = Array.isArray(payload.approvedAdjustmentIds)
        ? (payload.approvedAdjustmentIds as unknown[]).map(String).sort()
        : null;
      const adjustmentsChanged = storedIds
        ? storedIds.join(",") !== computed.approvedAdjustmentIds.join(",")
        : (payload.approvedAdjustmentCount !== undefined &&
            Number(payload.approvedAdjustmentCount) !== computed.approvedAdjustmentIds.length) ||
          (payload.approvedAdjustmentTotalSatang !== undefined &&
            String(payload.approvedAdjustmentTotalSatang) !==
              computed.approvedAdjustmentTotalSatang.toString());
      if (adjustmentsChanged) reasons.push("ADJUSTMENTS_CHANGED");
    }

    return {
      previewed,
      lineCount: storedLines.length,
      stale: reasons.length > 0,
      reasons,
      changedTutorUserIds: [...changed].sort(),
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Server-side gate for submit and approve: the run must have lines and must
   * match a recalculation made now. Throws SETTLEMENT_EMPTY,
   * SETTLEMENT_NOT_PREVIEWED or SettlementStaleError (SETTLEMENT_STALE:…).
   */
  static async assertRunReadyForReview(run: {
    settlementRunId: string;
    periodMonth: string;
    previewPayload: unknown;
  }) {
    const freshness = await SettlementService.getRunFreshness(run);
    if (freshness.lineCount === 0) throw new Error("SETTLEMENT_EMPTY");
    if (!freshness.previewed) throw new Error("SETTLEMENT_NOT_PREVIEWED");
    if (freshness.stale) throw new SettlementStaleError(freshness);
    return freshness;
  }

  static async refreshSettlementRun(
    snapshotId: string,
    options?: { actorId?: string; allowSubmitted?: boolean },
  ) {
    const run = await prisma.settlementRun.findUnique({
      where: { settlementRunId: snapshotId },
    });

    if (!run) throw new Error("NOT_FOUND");
    const refreshable = ["DRAFT", "ADJUSTMENT_PENDING", "REJECTED"];
    // A SUBMITTED run whose inputs changed after review goes back to DRAFT
    // (the caller has verified it is stale); it must be submitted again.
    if (options?.allowSubmitted) refreshable.push("SUBMITTED");
    if (!refreshable.includes(run.status)) {
      return {
        refreshed: false,
        status: run.status,
        totalPayoutSatang: null,
        totalNetPayoutSatang: null,
        payoutLineCount: null,
      };
    }

    // Claim the run before deleting/rebuilding lines. Submit/approve only
    // accept DRAFT/SUBMITTED, so REFRESHING closes the race window where a
    // checker could approve or a maker could submit half-refreshed lines.
    const claimed = await prisma.settlementRun.updateMany({
      where: {
        settlementRunId: snapshotId,
        status: run.status,
      },
      data: { status: "REFRESHING" },
    });
    if (claimed.count !== 1) throw new Error("SETTLEMENT_ALREADY_CLAIMED");

    try {
      const preview = await SettlementService.previewSettlement(
        run.periodMonth,
        options?.actorId ?? run.createdBy ?? "SYSTEM",
        { refreshRunId: snapshotId },
      );

      return {
        refreshed: true,
        status: preview.status,
        totalPayoutSatang: preview.totalPayoutSatang,
        totalNetPayoutSatang: preview.totalNetPayoutSatang,
        payoutLineCount: preview.payoutLineCount,
      };
    } catch (error) {
      await prisma.settlementRun.updateMany({
        where: { settlementRunId: snapshotId, status: "REFRESHING" },
        data: { status: run.status },
      });
      throw error;
    }
  }

  /**
   * Approves a SUBMITTED settlement run (Finance Checker only).
   */
  static async approveSettlement(
    snapshotId: string,
    approvedBy: string,
    options?: { allowDirectFromDraft?: boolean },
  ) {
    const run = await prisma.settlementRun.findUnique({
      where: { settlementRunId: snapshotId },
    });

    if (!run) throw new Error("NOT_FOUND");
    // Dev mode may approve a DRAFT directly (skips the SUBMITTED maker-checker step).
    // Production always requires a SUBMITTED run.
    const validStatuses = options?.allowDirectFromDraft
      ? ["DRAFT", "SUBMITTED"]
      : ["SUBMITTED"];
    if (!validStatuses.includes(run.status)) throw new Error("INVALID_STATUS");

    // Never approve an empty run, and never approve lines that no longer match
    // the inputs (adjustments approved/rejected, payments refunded, tutor
    // eligibility/identity changed) since they were calculated (F-2, F-3).
    await SettlementService.assertRunReadyForReview(run);

    const positivePayoutLines = await prisma.payoutLine.findMany({
      where: {
        settlementRunId: snapshotId,
        netPayoutMinor: { gt: 0n },
      },
      select: {
        payoutLineId: true,
        tutorUserId: true,
        payoutIdentityVersion: true,
        recipientSnapshot: true,
      },
    });
    // Auto-send transfers on approval whenever Omise is configured — no separate
    // "send transfer" step required. If Omise is not configured, lines fall back
    // to NOT_SENT (no throw) and can be sent later via retryPayoutTransfer.
    const shouldSendPayouts = isOmiseConfigured() && positivePayoutLines.length > 0;
    const recipientByTutor = new Map<string, string>();

    if (positivePayoutLines.length > 0) {
      const tutorIds = [...new Set(positivePayoutLines.map((line) => line.tutorUserId))];
      const tutors = await prisma.user.findMany({
        where: { userId: { in: tutorIds } },
        select: {
          userId: true,
          isActive: true,
          verificationStatus: true,
          payoutIdentityVersion: true,
          settings: true,
        },
      });

      validatePayoutIdentitySnapshots(positivePayoutLines, tutors);
      for (const line of positivePayoutLines) {
        recipientByTutor.set(line.tutorUserId, line.recipientSnapshot!);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claimedRun = await tx.settlementRun.updateMany({
        where: {
          settlementRunId: snapshotId,
          status: { in: options?.allowDirectFromDraft ? ["DRAFT", "SUBMITTED"] : ["SUBMITTED"] },
        },
        data: {
          status: "APPROVING",
          approvedBy,
          approvedAt: new Date(),
        },
      });

      if (claimedRun.count !== 1) {
        throw new Error("SETTLEMENT_ALREADY_CLAIMED");
      }

      const approvedRun = await tx.settlementRun.findUnique({
        where: { settlementRunId: snapshotId },
        include: { payoutLines: true },
      });
      if (!approvedRun) throw new Error("NOT_FOUND");

      const approvedPositiveLines = approvedRun.payoutLines
        .filter((line) => line.netPayoutMinor > 0n)
        .map((line) => ({
          payoutLineId: line.payoutLineId,
          tutorUserId: line.tutorUserId,
          payoutIdentityVersion: line.payoutIdentityVersion,
          recipientSnapshot: line.recipientSnapshot,
        }));
      if (approvedPositiveLines.length > 0) {
        const approvedTutors = await tx.user.findMany({
          where: { userId: { in: [...new Set(approvedPositiveLines.map((line) => line.tutorUserId))] } },
          select: {
            userId: true,
            isActive: true,
            verificationStatus: true,
            payoutIdentityVersion: true,
            settings: true,
          },
        });
        validatePayoutIdentitySnapshots(approvedPositiveLines, approvedTutors);
      }

      const payoutDocumentByLineId = new Map<string, Awaited<ReturnType<typeof tx.payoutDocument.upsert>>>();
      for (const line of approvedRun.payoutLines) {
        if (line.payoutAmountMinor <= 0n) continue;

        const payoutDocument = await tx.payoutDocument.upsert({
          where: { payoutLineId: line.payoutLineId },
          update: {},
          create: {
            payoutLineId: line.payoutLineId,
            tutorUserId: line.tutorUserId,
            documentNumber: buildPayoutDocumentNumber(line.payoutLineId),
            documentType: "PAY_SLIP_50_TAWI",
            grossAmountMinor: line.payoutAmountMinor,
            withholdingTaxMinor: line.withholdingTaxMinor,
            netAmountMinor: line.netPayoutMinor,
          },
        });
        payoutDocumentByLineId.set(line.payoutLineId, payoutDocument);
      }

      const finalizedRun = await tx.settlementRun.updateMany({
        where: { settlementRunId: snapshotId, status: "APPROVING" },
        data: { status: "APPROVED" },
      });
      if (finalizedRun.count !== 1) {
        throw new Error("SETTLEMENT_ALREADY_CLAIMED");
      }

      return {
        ...approvedRun,
        status: "APPROVED",
        payoutLines: approvedRun.payoutLines.map((line) => ({
          ...line,
          payoutDocument: payoutDocumentByLineId.get(line.payoutLineId) ?? null,
        })),
      };
    });

    for (const line of updated.payoutLines) {
      await updatePayoutTransferTracking(line.payoutLineId, {
        transferStatus:
          line.netPayoutMinor > 0n
            ? shouldSendPayouts
              ? "PENDING_TRANSFER"
              : "NOT_SENT"
            : "NO_TRANSFER_REQUIRED",
      });
    }

    if (shouldSendPayouts) {
      for (const line of updated.payoutLines) {
        if (line.netPayoutMinor <= 0n || !line.payoutDocument) continue;

        const recipient = recipientByTutor.get(line.tutorUserId);
        if (!recipient) continue;

        try {
          const transfer = await createOmiseTransfer({
            amount: Number(line.netPayoutMinor),
            recipient,
            failFast: true,
            metadata: {
              settlementRunId: snapshotId,
              payoutLineId: line.payoutLineId,
              payoutDocumentId: line.payoutDocument.payoutDocumentId,
              documentNumber: line.payoutDocument.documentNumber,
              tutorUserId: line.tutorUserId,
            },
            idempotencyKey: getTransferIdempotencyKey(line.payoutLineId),
          });

          const transferStatus = transferStatusFromOmise(transfer);
          await updatePayoutTransferTracking(line.payoutLineId, {
            provider: "omise",
            providerTransferId: transfer.id,
            transferStatus,
            transferFailureCode: transfer.failure_code ?? null,
            transferFailureMessage: transfer.failure_message ?? null,
            transferredAt: transfer.sent_at ? new Date(transfer.sent_at) : null,
          });
        } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
          await updatePayoutTransferTracking(line.payoutLineId, {
            provider: "omise",
            transferStatus: "TRANSFER_FAILED",
            transferFailureMessage: error.message,
          });
          throw new Error(`OMISE_TRANSFER_FAILED:${line.payoutLineId}:${error.message}`);
        }
      }
    }

    return updated;
  }

  static async retryPayoutTransfer(payoutLineId: string, snapshotId?: string) {
    if (!isOmiseConfigured()) {
      throw new Error("OMISE_PAYOUTS_NOT_CONFIGURED");
    }

    const line = await prisma.payoutLine.findUnique({
      where: { payoutLineId },
      include: {
        settlementRun: true,
        payoutDocument: true,
      },
    });

    if (!line) throw new Error("PAYOUT_LINE_NOT_FOUND");
    if (snapshotId && line.settlementRunId !== snapshotId) {
      throw new Error("PAYOUT_LINE_NOT_IN_SETTLEMENT");
    }
    if (line.settlementRun.status !== "APPROVED") {
      throw new Error("SETTLEMENT_NOT_APPROVED");
    }
    if (line.netPayoutMinor <= 0n) {
      throw new Error("NO_TRANSFER_REQUIRED");
    }
    if (!line.payoutDocument) {
      throw new Error("PAYOUT_DOCUMENT_NOT_FOUND");
    }
    if (
      hasActiveTransferStatus(line.payoutDocument.transferStatus) &&
      !line.payoutDocument.providerTransferId
    ) {
      let recovered: Awaited<ReturnType<typeof recoverPayoutTransfer>>;
      try {
        recovered = await recoverPayoutTransfer(line.payoutLineId);
      } catch (error_err) {
        const error = error_err as Error;
        throw new Error(`TRANSFER_RECOVERY_FAILED:${error.message}`);
      }
      if (!recovered || hasActiveTransferStatus(transferStatusFromOmise(recovered))) {
        throw new Error("TRANSFER_ALREADY_ACTIVE");
      }
      line.payoutDocument.transferStatus = transferStatusFromOmise(recovered);
    }

    if (hasActiveTransferStatus(line.payoutDocument.transferStatus)) {
      throw new Error("TRANSFER_ALREADY_ACTIVE");
    }

    const tutor = await prisma.user.findUnique({
      where: { userId: line.tutorUserId },
      select: {
        isActive: true,
        verificationStatus: true,
        payoutIdentityVersion: true,
        settings: true,
      },
    });
    validatePayoutIdentitySnapshots(
      [{
        payoutLineId: line.payoutLineId,
        tutorUserId: line.tutorUserId,
        payoutIdentityVersion: line.payoutIdentityVersion,
        recipientSnapshot: line.recipientSnapshot,
      }],
      tutor ? [{ userId: line.tutorUserId, ...tutor }] : [],
    );
    const recipient = line.recipientSnapshot!;

    await claimPayoutTransfer(line.payoutLineId);

    try {
      const transfer = await createOmiseTransfer({
        amount: Number(line.netPayoutMinor),
        recipient,
        failFast: true,
        metadata: {
          settlementRunId: line.settlementRunId,
          payoutLineId: line.payoutLineId,
          payoutDocumentId: line.payoutDocument.payoutDocumentId,
          documentNumber: line.payoutDocument.documentNumber,
          tutorUserId: line.tutorUserId,
          retry: "true",
        },
        idempotencyKey: getTransferIdempotencyKey(line.payoutLineId),
      });

      const transferStatus = transferStatusFromOmise(transfer);
      await updatePayoutTransferTracking(line.payoutLineId, {
        provider: "omise",
        providerTransferId: transfer.id,
        transferStatus,
        transferFailureCode: transfer.failure_code ?? null,
        transferFailureMessage: transfer.failure_message ?? null,
        transferredAt: transfer.sent_at ? new Date(transfer.sent_at) : null,
      });

      return {
        payoutLineId: line.payoutLineId,
        provider: "omise",
        providerTransferId: transfer.id,
        transferStatus,
        transferFailureCode: transfer.failure_code ?? null,
        transferFailureMessage: transfer.failure_message ?? null,
        transferredAt: transfer.sent_at ?? null,
      };
    } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
      await updatePayoutTransferTracking(line.payoutLineId, {
        provider: "omise",
        transferStatus: "TRANSFER_FAILED",
        transferFailureMessage: error.message,
      });
      throw new Error(`OMISE_TRANSFER_FAILED:${line.payoutLineId}:${error.message}`);
    }
  }

  /**
   * Pulls the latest transfer status from Omise and syncs it onto the payout
   * document. Used by the manual "refresh" button and auto-poll when the
   * webhook hasn't (yet) delivered the final state.
   */
  static async syncPayoutTransferStatus(payoutLineId: string) {
    const line = await prisma.payoutLine.findUnique({
      where: { payoutLineId },
      include: { payoutDocument: true },
    });

    if (!line) throw new Error("PAYOUT_LINE_NOT_FOUND");
    if (!line.payoutDocument) throw new Error("PAYOUT_DOCUMENT_NOT_FOUND");

    const providerTransferId = line.payoutDocument.providerTransferId;
    // Nothing to sync yet — no Omise transfer was ever created for this line.
    if (!providerTransferId) {
      return {
        payoutLineId,
        tutorUserId: line.tutorUserId,
        transferStatus: line.payoutDocument.transferStatus,
        transferredAt: line.payoutDocument.transferredAt?.toISOString() ?? null,
        synced: false,
      };
    }

    if (!isOmiseConfigured()) {
      throw new Error("OMISE_PAYOUTS_NOT_CONFIGURED");
    }

    const transfer = await retrieveOmiseTransfer(providerTransferId);
    const transferStatus = transferStatusFromOmise(transfer);
    const transferredAt = transfer.paid_at
      ? new Date(transfer.paid_at)
      : transfer.sent_at
        ? new Date(transfer.sent_at)
        : null;

    await updatePayoutTransferTracking(payoutLineId, {
      provider: "omise",
      providerTransferId,
      transferStatus,
      transferFailureCode: transfer.failure_code ?? null,
      transferFailureMessage: transfer.failure_message ?? null,
      transferredAt,
    });

    return {
      payoutLineId,
      tutorUserId: line.tutorUserId,
      transferStatus,
      transferredAt: transferredAt?.toISOString() ?? null,
      synced: true,
    };
  }
}
