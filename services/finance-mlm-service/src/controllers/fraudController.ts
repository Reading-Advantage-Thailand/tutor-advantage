import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  parsePaging,
  readReason,
  ReconciliationError,
  sendError,
} from "./reconciliationController";

export const ACTIVE_STATUSES = ["OPEN", "INVESTIGATING", "MONITORING", "FROZEN"];
const ALL_STATUSES = [...ACTIVE_STATUSES, "CLEARED"];
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
/** Accounts a fraud flag may never suspend (use the roles page instead). */
const PROTECTED_ROLES = ["ADMIN", "FINANCE_CHECKER", "FINANCE_MAKER"];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const FRAUD_ACTIONS = ["INVESTIGATE", "MONITOR", "FREEZE", "UNFREEZE", "CLEAR"] as const;
export type FraudAction = (typeof FRAUD_ACTIONS)[number];

export const mapActionToStatus = (action: string) => {
  switch (action.toUpperCase()) {
    case "CLEAR":
      return "CLEARED";
    case "MONITOR":
      return "MONITORING";
    case "FREEZE":
      return "FROZEN";
    default:
      // INVESTIGATE, UNFREEZE
      return "INVESTIGATING";
  }
};

/**
 * Decide whether releasing a frozen flag may re-activate the target account:
 * only when THIS flag's freeze suspended it, nothing changed the account
 * since (latest user status event is that freeze), and no other flag on the
 * same target is still frozen.
 */
export function shouldReactivateOnRelease(input: {
  userIsActive: boolean;
  flagId: string;
  latestUserStatusEvent: { action: string; payload: unknown } | null;
  otherFrozenFlags: number;
}): { reactivate: boolean; reason: string } {
  if (input.userIsActive) return { reactivate: false, reason: "ALREADY_ACTIVE" };
  const payload = (input.latestUserStatusEvent?.payload ?? {}) as Record<string, unknown>;
  if (
    input.latestUserStatusEvent?.action !== "USER_SUSPEND" ||
    payload.source !== "FRAUD_FREEZE" ||
    payload.flagId !== input.flagId
  ) {
    return { reactivate: false, reason: "SUSPENDED_ELSEWHERE" };
  }
  if (input.otherFrozenFlags > 0) return { reactivate: false, reason: "OTHER_FROZEN_FLAGS" };
  return { reactivate: true, reason: "RELEASED" };
}

export const getFraudFlags = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { q, status, severity, type } = query;
    const { page, pageSize, skip } = parsePaging(query);
    const where: Prisma.FraudFlagWhereInput = {};

    if (status === "ACTIVE") {
      where.status = { in: ACTIVE_STATUSES };
    } else if (status && status !== "ALL") {
      if (!ALL_STATUSES.includes(status)) {
        return sendError(req, res, 400, "INVALID_STATUS_FILTER", "Unknown fraud flag status");
      }
      where.status = status;
    }
    if (severity && severity !== "ALL") {
      if (!SEVERITIES.includes(severity)) {
        return sendError(req, res, 400, "INVALID_SEVERITY_FILTER", "Unknown severity");
      }
      where.severity = severity;
    }
    if (type && type !== "ALL") where.type = type;

    if (q?.trim()) {
      const search = q.trim();
      where.OR = [
        ...(UUID_RE.test(search) ? [{ flagId: search }] : []),
        { type: { contains: search, mode: "insensitive" } },
        { severity: { contains: search, mode: "insensitive" } },
        { targetId: { contains: search, mode: "insensitive" } },
        { targetName: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [flags, total, activeCount, frozenFlags, highRiskCount] =
      await Promise.all([
        prisma.fraudFlag.findMany({
          where,
          orderBy: { createdAt: query.order === "asc" ? "asc" : "desc" },
          skip,
          take: pageSize,
        }),
        prisma.fraudFlag.count({ where }),
        prisma.fraudFlag.count({
          where: { status: { in: ACTIVE_STATUSES } },
        }),
        prisma.fraudFlag.findMany({
          where: { status: "FROZEN" },
          select: { targetId: true },
        }),
        prisma.fraudFlag.count({
          where: {
            status: { in: ACTIVE_STATUSES },
            severity: { in: ["HIGH", "CRITICAL"] },
          },
        }),
      ]);

    const frozenTargets = [...new Set(frozenFlags.map((f) => f.targetId).filter((id) => UUID_RE.test(id)))];
    const targetIds = [
      ...new Set(flags.map((flag) => flag.targetId).filter((id) => UUID_RE.test(id))),
    ];
    const [targets, suspendedTargetCount] = await Promise.all([
      targetIds.length
        ? prisma.user.findMany({
            where: { userId: { in: targetIds } },
            select: { userId: true, role: true, isActive: true, displayName: true, email: true },
          })
        : [],
      frozenTargets.length
        ? prisma.user.count({ where: { userId: { in: frozenTargets }, isActive: false } })
        : 0,
    ]);
    const targetMap = new Map(targets.map((user) => [user.userId, user]));

    res.status(200).json({
      flags: flags.map((flag) => {
        const user = targetMap.get(flag.targetId);
        return {
          id: flag.flagId,
          type: flag.type,
          severity: flag.severity,
          targetId: flag.targetId,
          targetName: flag.targetName ?? user?.displayName ?? null,
          description: flag.description ?? "",
          status: flag.status,
          createdAt: flag.createdAt,
          updatedAt: flag.updatedAt,
          target: user
            ? {
                userId: user.userId,
                role: user.role,
                isActive: user.isActive,
                displayName: user.displayName,
                email: user.email,
              }
            : null,
        };
      }),
      total,
      page,
      pageSize,
      stats: {
        activeCount,
        highRiskCount,
        frozenCount: frozenFlags.length,
        /** Frozen-flag targets whose account really is suspended (is_active=false). */
        suspendedTargetCount,
        /** Frozen-flag targets that can still sign in (pre-fix freezes). */
        frozenButActiveCount: frozenTargets.length - suspendedTargetCount,
        // Back-compat for older consoles.
        velocityStatus: highRiskCount > 0 ? "Review" : "Normal",
        autoSuspensions: suspendedTargetCount,
      },
    });
  } catch (error) {
    logger.error("Get Fraud Flags Error:", error);
    sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not fetch fraud flags");
  }
};

/**
 * POST /v1/fraud-flags/:id/action { action, reason }
 *  - FREEZE: flag → FROZEN **and** suspends the target account
 *    (identity.users.is_active=false + payout identity bump, same as the
 *    admin suspend path) with audit USER_SUSPEND. ADMIN only.
 *  - UNFREEZE / CLEAR / MONITOR / INVESTIGATE on a frozen flag: releases it
 *    and re-activates the account only if this freeze suspended it (see
 *    shouldReactivateOnRelease). ADMIN only when the flag is FROZEN.
 */
export const triggerFraudAction = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { id } = req.params;
  const actorId = req.user?.userId || "SYSTEM";
  const actorRole = req.user?.role;

  try {
    const rawAction = String((req.body as { action?: unknown })?.action ?? "").toUpperCase();
    if (!(FRAUD_ACTIONS as readonly string[]).includes(rawAction)) {
      return sendError(req, res, 400, "INVALID_FRAUD_ACTION", `action must be one of ${FRAUD_ACTIONS.join(", ")}`);
    }
    const action = rawAction as FraudAction;
    const reason = readReason(req.body);
    if (!UUID_RE.test(id)) return sendError(req, res, 400, "BAD_REQUEST", "Invalid flag id");

    const current = await prisma.fraudFlag.findUnique({
      where: { flagId: id },
    });
    if (!current) {
      return sendError(req, res, 404, "NOT_FOUND", "Fraud flag not found");
    }

    const newStatus = mapActionToStatus(action);
    const touchesAccount = action === "FREEZE" || current.status === "FROZEN";
    if (touchesAccount && actorRole !== "ADMIN") {
      return sendError(req, res, 403, "ADMIN_REQUIRED", "Only an admin can freeze or release an account");
    }
    if (action === "UNFREEZE" && current.status !== "FROZEN") {
      return sendError(req, res, 409, "FLAG_NOT_FROZEN", "This flag is not frozen");
    }

    const target = UUID_RE.test(current.targetId)
      ? await prisma.user.findUnique({
          where: { userId: current.targetId },
          select: { userId: true, role: true, isActive: true },
        })
      : null;

    if (action === "FREEZE") {
      if (!target) {
        return sendError(req, res, 409, "FRAUD_TARGET_NOT_USER", "The flag target is not a user account");
      }
      if (PROTECTED_ROLES.includes(target.role) || target.userId === actorId) {
        return sendError(req, res, 409, "CANNOT_SUSPEND_STAFF", "Staff accounts cannot be suspended from a fraud flag");
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let userChanged = false;
      let userNote = "NO_TARGET_USER";

      if (current.status !== newStatus) {
        const claimed = await tx.fraudFlag.updateMany({
          where: { flagId: id, status: current.status },
          data: { status: newStatus, updatedAt: new Date() },
        });
        if (claimed.count !== 1) {
          throw new ReconciliationError(409, "CONCURRENT_UPDATE", "Flag changed meanwhile; reload and retry");
        }
      }

      if (action === "FREEZE" && target) {
        // Also enforces a freeze recorded before freezes suspended accounts.
        const suspended = await tx.user.updateMany({
          where: { userId: target.userId, isActive: true },
          data: { isActive: false, payoutIdentityVersion: { increment: 1 }, updatedAt: new Date() },
        });
        userChanged = suspended.count === 1;
        userNote = userChanged ? "SUSPENDED" : "ALREADY_SUSPENDED";
        if (userChanged) {
          await tx.auditEvent.create({
            data: {
              actorId,
              action: "USER_SUSPEND",
              entityType: "User",
              entityId: target.userId,
              payload: { isActive: false, source: "FRAUD_FREEZE", flagId: id, reason },
            },
          });
        }
      } else if (current.status === "FROZEN" && newStatus !== "FROZEN" && target) {
        const [latestUserStatusEvent, otherFrozenFlags] = await Promise.all([
          tx.auditEvent.findFirst({
            where: {
              entityType: "User",
              entityId: target.userId,
              action: { in: ["USER_SUSPEND", "USER_UNSUSPEND"] },
            },
            orderBy: { createdAt: "desc" },
            select: { action: true, payload: true },
          }),
          tx.fraudFlag.count({
            where: { targetId: target.userId, status: "FROZEN", NOT: { flagId: id } },
          }),
        ]);
        const decision = shouldReactivateOnRelease({
          userIsActive: target.isActive,
          flagId: id,
          latestUserStatusEvent,
          otherFrozenFlags,
        });
        userNote = decision.reason;
        if (decision.reactivate) {
          const restored = await tx.user.updateMany({
            where: { userId: target.userId, isActive: false },
            data: { isActive: true, payoutIdentityVersion: { increment: 1 }, updatedAt: new Date() },
          });
          userChanged = restored.count === 1;
          if (userChanged) {
            await tx.auditEvent.create({
              data: {
                actorId,
                action: "USER_UNSUSPEND",
                entityType: "User",
                entityId: target.userId,
                payload: { isActive: true, source: "FRAUD_RELEASE", flagId: id, reason },
              },
            });
          }
        }
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          action: `FRAUD_${action}`,
          entityType: "FraudFlag",
          entityId: id,
          payload: {
            previousStatus: current.status,
            newStatus,
            targetId: current.targetId,
            type: current.type,
            reason,
            userChanged,
            userNote,
          },
        },
      });

      const user = target
        ? await tx.user.findUnique({
            where: { userId: target.userId },
            select: { userId: true, isActive: true },
          })
        : null;
      return { userChanged, userNote, user };
    });

    res.status(200).json({
      success: true,
      flag: { id, status: newStatus },
      user: result.user,
      userChanged: result.userChanged,
      userNote: result.userNote,
    });
  } catch (error) {
    if (error instanceof ReconciliationError) {
      return sendError(req, res, error.status, error.code, error.message, error.details);
    }
    logger.error("Fraud Action Error:", error);
    sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not update fraud flag");
  }
};
