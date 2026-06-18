/**
 * devController.ts
 *
 * DEV-ONLY endpoints for managing users (CRUD) and triggering test actions.
 * All routes mounting this controller are guarded by devOnlyMiddleware —
 * they will never be reachable in production.
 */
import { logger } from "@tutor-advantage/shared-config";
import { Request, Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { SettlementService } from "../services/settlementService";

const ALLOWED_ROLES = ["ADMIN", "TUTOR", "STUDENT", "FINANCE_CHECKER"];

// GET /v1/dev/users
export const devListUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        userId: true,
        role: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        isActive: true,
        verificationStatus: true,
        verificationComment: true,
        sponsorTutorId: true,
        createdAt: true,
        updatedAt: true,
        oauthIdentities: {
          select: { provider: true, providerSubject: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  } catch (err) {
    logger.error("devListUsers error:", err);
    res.status(500).json({ error: "Could not list users" });
  }
};

// POST /v1/dev/users
export const devCreateUser = async (req: Request, res: Response) => {
  const { role, displayName, email, phoneNumber, isActive, verificationStatus } = req.body;

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
  }

  try {
    const user = await prisma.user.create({
      data: {
        role,
        displayName: displayName || null,
        email: email || null,
        phoneNumber: phoneNumber || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        verificationStatus: verificationStatus || "UNVERIFIED",
      },
    });
    res.status(201).json({ user });
  } catch (err_err) {
    const err = err_err as Error & { code?: string; details?: string; };
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    logger.error("devCreateUser error:", err);
    res.status(500).json({ error: "Could not create user" });
  }
};

// PATCH /v1/dev/users/:id
export const devUpdateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    role,
    displayName,
    email,
    phoneNumber,
    profilePictureUrl,
    isActive,
    verificationStatus,
    verificationComment,
    sponsorTutorId,
  } = req.body;

  if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
  }

  const data: Record<string, unknown> = {};
  if (role !== undefined) data.role = role;
  if (displayName !== undefined) data.displayName = displayName || null;
  if (email !== undefined) data.email = email || null;
  if (phoneNumber !== undefined) data.phoneNumber = phoneNumber || null;
  if (profilePictureUrl !== undefined) data.profilePictureUrl = profilePictureUrl || null;
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  if (verificationStatus !== undefined) data.verificationStatus = verificationStatus;
  if (verificationComment !== undefined) data.verificationComment = verificationComment || null;
  if (sponsorTutorId !== undefined) data.sponsorTutorId = sponsorTutorId || null;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const user = await prisma.user.update({
      where: { userId: id },
      data,
    });
    res.json({ user });
  } catch (err_err) {
    const err = err_err as Error & { code?: string; details?: string; };
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    logger.error("devUpdateUser error:", err);
    res.status(500).json({ error: "Could not update user" });
  }
};

// DELETE /v1/dev/users/:id
export const devDeleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Hard delete — cascade handled by DB foreign key constraints
    await prisma.user.delete({ where: { userId: id } });
    res.json({ success: true, message: `User ${id} permanently deleted` });
  } catch (err_err) {
    const err = err_err as Error & { code?: string; details?: string; };
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    logger.error("devDeleteUser error:", err);
    res.status(500).json({ error: "Could not delete user" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DEV ACTION ENDPOINTS — trigger real service operations without auth checks
// ─────────────────────────────────────────────────────────────────────────────

// GET /v1/dev/state — snapshot of current system state for the toolbar
export const devGetState = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const ictOffset = 7 * 60 * 60 * 1000;
    const ict = new Date(now.getTime() + ictOffset);
    const currentMonth = `${ict.getUTCFullYear()}-${String(ict.getUTCMonth() + 1).padStart(2, "0")}`;
    const prevMonth = (() => {
      const d = new Date(Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), 1) - 1);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    })();

    const [
      userCount,
      tutorCount,
      latestRun,
      pendingAdjustments,
      openFraudFlags,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "TUTOR" } }),
      prisma.settlementRun.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.adjustment.count({ where: { status: "PENDING" } }),
      prisma.fraudFlag.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    ]);

    res.json({
      currentMonth,
      prevMonth,
      userCount,
      tutorCount,
      latestRun: latestRun
        ? { id: latestRun.settlementRunId, period: latestRun.periodMonth, status: latestRun.status }
        : null,
      pendingAdjustments,
      openFraudFlags,
    });
  } catch (err) {
    logger.error("devGetState error:", err);
    res.status(500).json({ error: "Could not fetch state" });
  }
};

// POST /v1/dev/actions/settlement — preview settlement for given or current month
export const devRunSettlement = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const ictOffset = 7 * 60 * 60 * 1000;
    const ict = new Date(now.getTime() + ictOffset);
    const currentMonth = `${ict.getUTCFullYear()}-${String(ict.getUTCMonth() + 1).padStart(2, "0")}`;

    const periodMonth: string = req.body?.periodMonth || currentMonth;

    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      return res.status(400).json({ error: "periodMonth must be YYYY-MM" });
    }

    // Check idempotency
    const existing = await prisma.settlementRun.findFirst({
      where: { periodMonth },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return res.status(200).json({
        message: `Settlement run for ${periodMonth} already exists — skipped`,
        settlementRunId: existing.settlementRunId,
        periodMonth,
        skipped: true,
      });
    }

    const preview = await SettlementService.previewSettlement(periodMonth, "DEV_TOOL");
    const lineCount = await prisma.payoutLine.count({
      where: { settlementRunId: preview.snapshotId },
    });
    res.status(201).json({
      message: `Settlement preview created for ${periodMonth}`,
      settlementRunId: preview.snapshotId,
      periodMonth,
      tutorCount: lineCount,
      skipped: false,
    });
  } catch (err_err) {
    const err = err_err as Error & { code?: string; details?: string; };
    logger.error("devRunSettlement error:", err);
    res.status(500).json({ error: err.message || "Could not run settlement" });
  }
};

// POST /v1/dev/actions/fraud-flag — create mock fraud flag
export const devSeedFraudFlag = async (req: Request, res: Response) => {
  try {
    const {
      type = "SUSPICIOUS_VOLUME",
      severity = "HIGH",
      targetId = "dev-test-target",
      targetName = "[DEV] Test Target",
      description = "Automatically created by Dev Toolbar for testing",
    } = req.body || {};

    const flag = await prisma.fraudFlag.create({
      data: { type, severity, targetId, targetName, description, status: "OPEN" },
    });
    res.status(201).json({ flag });
  } catch (err_err) {
    const err = err_err as Error & { code?: string; details?: string; };
    logger.error("devSeedFraudFlag error:", err);
    res.status(500).json({ error: "Could not create fraud flag" });
  }
};

// DELETE /v1/dev/actions/fraud-flag/:id — hard delete a specific fraud flag
export const devDeleteFraudFlag = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.fraudFlag.delete({ where: { flagId: id } });
    res.json({ success: true });
  } catch (err_err) {
    const err = err_err as Error & { code?: string; details?: string; };
    if (err?.code === "P2025") return res.status(404).json({ error: "Flag not found" });
    logger.error("devDeleteFraudFlag error:", err);
    res.status(500).json({ error: "Could not delete flag" });
  }
};

// POST /v1/dev/actions/adjustment — create mock adjustment on latest settlement run
export const devSeedAdjustment = async (req: Request, res: Response) => {
  try {
    const { tutorUserId, amountTHB = 100, reason = "[DEV] Test adjustment" } = req.body || {};

    // Find latest settlement run
    const run = await prisma.settlementRun.findFirst({ orderBy: { createdAt: "desc" } });
    if (!run) {
      return res.status(404).json({ error: "No settlement run found — run settlement first" });
    }

    // Resolve tutorUserId: use provided or pick first TUTOR
    let resolvedTutorId = tutorUserId;
    if (!resolvedTutorId) {
      const tutor = await prisma.user.findFirst({ where: { role: "TUTOR", isActive: true } });
      if (!tutor) return res.status(404).json({ error: "No TUTOR user found — create one first" });
      resolvedTutorId = tutor.userId;
    }

    const amountMinor = BigInt(Math.round(Number(amountTHB) * 100));
    const adjustment = await prisma.adjustment.create({
      data: {
        settlementRunId: run.settlementRunId,
        tutorUserId: resolvedTutorId,
        amountMinor,
        reason,
        status: "PENDING",
        createdBy: "DEV_TOOL",
      },
    });

    res.status(201).json({
      adjustment: {
        ...adjustment,
        amountMinor: adjustment.amountMinor.toString(),
      },
      settlementRunId: run.settlementRunId,
      periodMonth: run.periodMonth,
    });
  } catch (err_err) {
    const err = err_err as Error & { code?: string; details?: string; };
    logger.error("devSeedAdjustment error:", err);
    res.status(500).json({ error: err.message || "Could not create adjustment" });
  }
};

// DELETE /v1/dev/actions/purge — purge all dev-created seeded data
export const devPurge = async (req: Request, res: Response) => {
  const { resource } = req.body as { resource?: string };
  try {
    const results: Record<string, number> = {};
    if (!resource || resource === "fraud") {
      const r = await prisma.fraudFlag.deleteMany({
        where: { targetName: { contains: "[DEV]" } },
      });
      results.fraudFlags = r.count;
    }
    if (!resource || resource === "adjustments") {
      const r = await prisma.adjustment.deleteMany({ where: { createdBy: "DEV_TOOL" } });
      results.adjustments = r.count;
    }
    if (!resource || resource === "settlements") {
      // Only purge PENDING runs created by DEV_TOOL
      const runs = await prisma.settlementRun.findMany({
        where: { createdBy: "DEV_TOOL", status: "PENDING" },
        select: { settlementRunId: true },
      });
      if (runs.length) {
        await prisma.adjustment.deleteMany({
          where: { settlementRunId: { in: runs.map((r) => r.settlementRunId) } },
        });
        const r = await prisma.settlementRun.deleteMany({
          where: { settlementRunId: { in: runs.map((r) => r.settlementRunId) } },
        });
        results.settlementRuns = r.count;
      }
    }
    if (resource === "all-settlements") {
      // Nuclear option — wipe ALL settlement data regardless of status/creator
      const allRuns = await prisma.settlementRun.findMany({
        select: { settlementRunId: true },
      });
      const ids = allRuns.map((r) => r.settlementRunId);
      if (ids.length) {
        await prisma.payoutDocument.deleteMany({ where: { payoutLine: { settlementRunId: { in: ids } } } });
        await prisma.payoutLine.deleteMany({ where: { settlementRunId: { in: ids } } });
        await prisma.adjustment.deleteMany({ where: { settlementRunId: { in: ids } } });
        const r = await prisma.settlementRun.deleteMany({
          where: { settlementRunId: { in: ids } },
        });
        results.settlementRuns = r.count;
      }
    }
    if (resource === "volume") {
      // Delete all DEV payment intents (idempotencyKey starts with DEV_VOL_)
      const r = await prisma.paymentIntent.deleteMany({
        where: { idempotencyKey: { startsWith: "DEV_VOL_" } },
      });
      results.devPayments = r.count;
    }
    res.json({ success: true, deleted: results });
  } catch (err_err) {
    const err = err_err as Error & { code?: string; details?: string; };
    logger.error("devPurge error:", err);
    res.status(500).json({ error: "Could not purge data" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TUTOR SIMULATION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

const VALID_BADGES = [
  "ELITE_EDUCATOR",
  "TOP_RATED",
  "CLASS_MASTER",
  "NETWORK_BUILDER",
  "RISING_STAR",
  "FAST_RESPONDER",
  "AI_PIONEER",
] as const;

// GET /v1/dev/tutor-badges/:tutorUserId
export const devGetTutorBadges = async (req: Request, res: Response) => {
  const { tutorUserId } = req.params;
  try {
    const badges = await prisma.tutorBadge.findMany({
      where: { tutorUserId },
      select: { badgeCode: true },
    });
    res.json({ badges: badges.map((b) => b.badgeCode) });
  } catch (err) {
    logger.error("devGetTutorBadges error:", err);
    res.status(500).json({ error: "Could not fetch badges" });
  }
};

// POST /v1/dev/actions/add-volume
export const devAddVolume = async (req: Request, res: Response) => {
  const { tutorUserId, amountTHB = 1000 } = req.body || {};
  if (!tutorUserId) return res.status(400).json({ error: "tutorUserId required" });

  const amount = Number(amountTHB);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    return res.status(400).json({ error: "amountTHB must be > 0 and ≤ 10,000,000" });
  }

  try {
    // Verify tutor exists
    const tutor = await prisma.user.findUnique({ where: { userId: tutorUserId } });
    if (!tutor || tutor.role !== "TUTOR") {
      return res.status(404).json({ error: "Tutor not found" });
    }

    // Find any book for DEV class
    const book = await prisma.book.findFirst();
    if (!book) return res.status(400).json({ error: "No books found — cannot create DEV class" });

    // Find or create DEV class for this tutor
    let devClass = await prisma.class.findFirst({
      where: { tutorUserId, title: "[DEV] Test Class" },
    });
    if (!devClass) {
      devClass = await prisma.class.create({
        data: {
          tutorUserId,
          bookId: book.bookId,
          title: "[DEV] Test Class",
          capacity: 999,
          packagePriceMinor: 250000n,
          status: "ACTIVE",
        },
      });
    }

    // Find or create DEV enrollment (tutor acts as student)
    let devEnrollment = await prisma.enrollment.findFirst({
      where: { classId: devClass.classId, studentUserId: tutorUserId },
    });
    if (!devEnrollment) {
      devEnrollment = await prisma.enrollment.create({
        data: {
          classId: devClass.classId,
          studentUserId: tutorUserId,
          status: "ACTIVE",
        },
      });
    }

    // Create SUCCESS payment intent tagged as DEV
    const amountMinor = BigInt(Math.round(amount * 100));
    const iKey = `DEV_VOL_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payment = await prisma.paymentIntent.create({
      data: {
        enrollmentId: devEnrollment.enrollmentId,
        studentUserId: tutorUserId,
        amountMinor,
        currency: "THB",
        method: "DEV",
        status: "SUCCESS",
        idempotencyKey: iKey,
      },
    });

    return res.status(201).json({
      paymentIntentId: payment.paymentIntentId,
      amountTHB: Number(amountMinor) / 100,
      message: `Added DEV volume ฿${amount.toLocaleString()}`,
    });
  } catch (err_err) {
    const err = err_err as Error & { code?: string; details?: string; };
    logger.error("devAddVolume error:", err);
    res.status(500).json({ error: err.message || "Could not add volume" });
  }
};

// POST /v1/dev/actions/toggle-badge
export const devToggleBadge = async (req: Request, res: Response) => {
  const { tutorUserId, badgeCode } = req.body || {};
  if (!tutorUserId) return res.status(400).json({ error: "tutorUserId required" });
  if (!badgeCode || !VALID_BADGES.includes(badgeCode)) {
    return res.status(400).json({ error: `badgeCode must be one of: ${VALID_BADGES.join(", ")}` });
  }

  try {
    const existing = await prisma.tutorBadge.findFirst({
      where: { tutorUserId, badgeCode },
    });

    if (existing) {
      await prisma.tutorBadge.delete({ where: { badgeId: existing.badgeId } });
      return res.json({ action: "removed", badgeCode });
    } else {
      await prisma.tutorBadge.create({ data: { tutorUserId, badgeCode } });
      return res.json({ action: "added", badgeCode });
    }
  } catch (err_err) {
    const err = err_err as Error & { code?: string; details?: string; };
    logger.error("devToggleBadge error:", err);
    res.status(500).json({ error: err.message || "Could not toggle badge" });
  }
};
