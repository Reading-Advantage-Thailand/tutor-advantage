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
      "provider_transfer_id" = ${data.providerTransferId ?? null},
      "transfer_status" = ${data.transferStatus},
      "transfer_failure_code" = ${data.transferFailureCode ?? null},
      "transfer_failure_message" = ${data.transferFailureMessage ?? null},
      "transferred_at" = ${data.transferredAt ?? null}
    WHERE "payout_line_id" = ${payoutLineId}::uuid
  `;
}

export class SettlementService {
  /**
   * Generates a preview for a settlement period.
   * This calculation uses a Bottom-Up approach for a unilevel or differential tree.
   */
  static async previewSettlement(
    periodMonth: string,
    createdBy: string,
    options?: { refreshRunId?: string },
  ) {
    const { start: startOfMonth, end: endOfMonth } =
      getIctMonthWindow(periodMonth);

    // Block if an active (DRAFT or SUBMITTED) run already exists for this period
    if (!options?.refreshRunId) {
      const existingActive = await prisma.settlementRun.findFirst({
        where: { periodMonth, status: { in: ["DRAFT", "SUBMITTED"] } },
      });
      if (existingActive) throw new Error("DRAFT_EXISTS");
    }

    const payments = await prisma.paymentIntent.findMany({
      where: {
        status: "SUCCESS",
        updatedAt: {
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
      const tutorId = enrollmentTutorMap.get(payment.enrollmentId);
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
        reason: true,
      },
    });

    const adjustmentTotals = new Map<string, bigint>();
    for (const adjustment of approvedAdjustments) {
      adjustmentTotals.set(
        adjustment.tutorUserId,
        (adjustmentTotals.get(adjustment.tutorUserId) || 0n) +
          adjustment.amountMinor,
      );
    }

    // 3. Build the organizational tree to calculate Group Volume (GV) and Payouts
    // For a real MLM tree, we need the upline structure.
    // Load all active tutors for tree structure — verification checked per-node below
    const allUsers = await prisma.user.findMany({
      where: { role: "TUTOR", isActive: true },
      select: { userId: true, sponsorTutorId: true, verificationStatus: true },
    });

    const nodes = new Map<string, PayoutNode>();
    for (const u of allUsers) {
      nodes.set(u.userId, {
        userId: u.userId,
        sponsorId: u.sponsorTutorId,
        personalVolumeMinor: tutorVolumes.get(u.userId) || 0n,
        groupVolumeMinor: tutorVolumes.get(u.userId) || 0n, // Initially GV = PV
        payoutRate: 0,
        payoutAmountMinor: 0n,
        eligibilityStatus: "ELIGIBLE_BASE",
        verified: u.verificationStatus === "VERIFIED",
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
        });
      }
    }

    // 4. Graph traversal for accurate GV and Payout calculation.
    const childMap = new Map<string, string[]>();
    for (const node of nodes.values()) {
      if (node.sponsorId) {
        if (!childMap.has(node.sponsorId)) {
          childMap.set(node.sponsorId, []);
        }
        childMap.get(node.sponsorId)!.push(node.userId);
      }
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
      if (!node.sponsorId) {
        calculateGV(node.userId);
      }
    }

    let totalPayoutSatang = 0n;

    const calculatePayouts = (userId: string, visiting = new Set<string>()) => {
      if (visiting.has(userId)) {
        throw new Error("SPONSOR_TREE_CYCLE");
      }
      visiting.add(userId);

      const node = nodes.get(userId)!;
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
      if (!node.sponsorId) {
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

    const previewPayload = {
      paymentCount: payments.length,
      approvedAdjustmentCount: approvedAdjustments.length,
      approvedAdjustmentTotalSatang: approvedAdjustments
        .reduce((sum, adjustment) => sum + adjustment.amountMinor, 0n)
        .toString(),
      ...(options?.refreshRunId
        ? { refreshedAt: new Date().toISOString() }
        : {}),
    };

    // 6. Persist Draft Settlement Run, or refresh an existing active run.
    const run = options?.refreshRunId
      ? await prisma.settlementRun.update({
          where: { settlementRunId: options.refreshRunId },
          data: { previewPayload },
        })
      : await prisma.settlementRun.create({
          data: {
            periodMonth,
            status: "DRAFT",
            createdBy,
            previewPayload,
          },
        });

    if (options?.refreshRunId) {
      const existingLines = await prisma.payoutLine.findMany({
        where: { settlementRunId: options.refreshRunId },
        select: { payoutLineId: true },
      });
      const existingLineIds = existingLines.map((line) => line.payoutLineId);

      if (existingLineIds.length > 0) {
        await prisma.payoutDocument.deleteMany({
          where: { payoutLineId: { in: existingLineIds } },
        });
      }

      await prisma.payoutLine.deleteMany({
        where: { settlementRunId: options.refreshRunId },
      });
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

    // Bulk insert payout lines
    let payoutLineCount = 0;
    let totalNetPayoutSatang = 0n;
    for (const node of nodes.values()) {
      // Unverified tutors are blocked from ALL payouts — commission was already zeroed above.
      // Also block badge bonuses and adjustments so unverified tutors receive nothing.
      const effectiveAdjustment = node.verified
        ? (adjustmentTotals.get(node.userId) || 0n)
        : 0n;
      const effectiveBadgeBonus = node.verified
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

      await prisma.payoutLine.create({
        data: {
          settlementRunId: run.settlementRunId,
          tutorUserId: node.userId,
          grossVolumeMinor: node.groupVolumeMinor,
          payoutRate: new Prisma.Decimal(node.payoutRate),
          payoutAmountMinor: adjustedPayoutMinor,
          withholdingTaxMinor: tax.withholdingTaxMinor,
          netPayoutMinor: tax.netPayoutMinor,
          badgeBonusMinor: effectiveBadgeBonus,
          eligibilityStatus,
        },
      });
      payoutLineCount++;
    }

    return {
      snapshotId: run.settlementRunId,
      periodMonth,
      totalPayoutSatang: Number(totalPayoutSatang),
      totalNetPayoutSatang: Number(totalNetPayoutSatang),
      payoutLineCount,
      status: run.status,
    };
  }

  static async refreshSettlementRun(snapshotId: string) {
    const run = await prisma.settlementRun.findUnique({
      where: { settlementRunId: snapshotId },
    });

    if (!run) throw new Error("NOT_FOUND");
    if (!["DRAFT", "SUBMITTED"].includes(run.status)) {
      return {
        refreshed: false,
        status: run.status,
        totalPayoutSatang: null,
        totalNetPayoutSatang: null,
        payoutLineCount: null,
      };
    }

    const preview = await SettlementService.previewSettlement(
      run.periodMonth,
      run.createdBy ?? "SYSTEM",
      { refreshRunId: snapshotId },
    );

    return {
      refreshed: true,
      status: run.status,
      totalPayoutSatang: preview.totalPayoutSatang,
      totalNetPayoutSatang: preview.totalNetPayoutSatang,
      payoutLineCount: preview.payoutLineCount,
    };
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

    const positivePayoutLines = await prisma.payoutLine.findMany({
      where: {
        settlementRunId: snapshotId,
        netPayoutMinor: { gt: 0n },
      },
      select: {
        payoutLineId: true,
        tutorUserId: true,
      },
    });
    // Auto-send transfers on approval whenever Omise is configured — no separate
    // "send transfer" step required. If Omise is not configured, lines fall back
    // to NOT_SENT (no throw) and can be sent later via retryPayoutTransfer.
    const shouldSendPayouts = isOmiseConfigured() && positivePayoutLines.length > 0;
    const recipientByTutor = new Map<string, string>();

    if (shouldSendPayouts) {
      const tutorIds = [...new Set(positivePayoutLines.map((line) => line.tutorUserId))];
      const tutors = await prisma.user.findMany({
        where: { userId: { in: tutorIds } },
        select: { userId: true, settings: true },
      });

      for (const tutor of tutors) {
        const recipientId = getOmiseRecipientId(tutor.settings);
        if (recipientId) recipientByTutor.set(tutor.userId, recipientId);
      }

      const missingTutorIds = tutorIds.filter((id) => !recipientByTutor.has(id));
      if (missingTutorIds.length > 0) {
        throw new Error(`MISSING_OMISE_RECIPIENT:${missingTutorIds.join(",")}`);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const approvedRun = await tx.settlementRun.update({
        where: { settlementRunId: snapshotId },
        data: {
          status: "APPROVED",
          approvedBy,
          approvedAt: new Date(),
        },
        include: { payoutLines: true },
      });

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

      return {
        ...approvedRun,
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
    if (hasActiveTransferStatus(line.payoutDocument.transferStatus)) {
      throw new Error("TRANSFER_ALREADY_ACTIVE");
    }

    const tutor = await prisma.user.findUnique({
      where: { userId: line.tutorUserId },
      select: { settings: true },
    });
    const recipient = getOmiseRecipientId(tutor?.settings);
    if (!recipient) {
      throw new Error(`MISSING_OMISE_RECIPIENT:${line.tutorUserId}`);
    }

    await updatePayoutTransferTracking(line.payoutLineId, {
      provider: "omise",
      transferStatus: "PENDING_TRANSFER",
      transferFailureCode: null,
      transferFailureMessage: null,
      transferredAt: null,
    });

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
