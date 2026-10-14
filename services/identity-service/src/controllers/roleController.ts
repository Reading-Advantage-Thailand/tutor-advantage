import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { logger } from "@tutor-advantage/shared-config";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

/*
 * Staff role management (admin console /settings/roles).
 *
 * Rules (admin audit S-6):
 * - Only staff accounts can hold staff roles: ADMIN / FINANCE_CHECKER can be
 *   given to a new (pre-provisioned) email or moved between staff roles, never
 *   to an existing TUTOR / STUDENT / GUARDIAN account (minors, learners).
 * - Staff cannot be turned into learners; access is removed by revoking
 *   (deactivating) the staff account instead.
 * - Nobody can change their own role or access.
 * - The last active ADMIN can never be demoted or revoked.
 * - Every change needs a reason and writes an audit event in the same
 *   transaction as the change (finance_mlm.audit_events, entityType "User").
 */

export const STAFF_ROLES = ["ADMIN", "FINANCE_CHECKER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
const MIN_REASON_LENGTH = 5;

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

const isStaffRole = (role: unknown): role is StaffRole =>
  typeof role === "string" && (STAFF_ROLES as readonly string[]).includes(role);

export type RoleChangeDecision =
  | { ok: true; kind: "CREATE" | "UNCHANGED" | "GRANT" | "CHANGE" | "REVOKE" | "RESTORE" }
  | { ok: false; status: number; code: string; message: string };

/**
 * Pure rule check for a requested staff role/access change.
 * `current` is null when the email has no account yet.
 */
export function decideRoleChange(input: {
  actorId: string;
  current: { userId: string; role: string; isActive: boolean } | null;
  targetRole: StaffRole;
  targetActive: boolean;
  otherActiveAdmins: number;
}): RoleChangeDecision {
  const { actorId, current, targetRole, targetActive, otherActiveAdmins } = input;

  if (!current) {
    if (!targetActive) {
      return { ok: false, status: 404, code: "USER_NOT_FOUND", message: "No account with this email" };
    }
    return { ok: true, kind: "CREATE" };
  }

  if (!isStaffRole(current.role)) {
    return {
      ok: false,
      status: 409,
      code: "ROLE_TRANSITION_NOT_ALLOWED",
      message: `A ${current.role} account cannot receive a staff role. Use a separate staff email.`,
    };
  }

  if (current.role === targetRole && current.isActive === targetActive) {
    return { ok: true, kind: "UNCHANGED" };
  }

  if (current.userId === actorId) {
    return { ok: false, status: 409, code: "CANNOT_CHANGE_SELF", message: "You cannot change your own role or access" };
  }

  const losesAdmin =
    current.role === "ADMIN" && current.isActive && (targetRole !== "ADMIN" || !targetActive);
  if (losesAdmin && otherActiveAdmins < 1) {
    return { ok: false, status: 409, code: "LAST_ADMIN", message: "At least one active ADMIN must remain" };
  }

  if (!targetActive) return { ok: true, kind: "REVOKE" };
  if (!current.isActive) return { ok: true, kind: "RESTORE" };
  return { ok: true, kind: targetRole === "ADMIN" ? "GRANT" : "CHANGE" };
}

/** Same action name finance's audit helper uses (AUDIT_ACTIONS.ROLE_CHANGE); `payload.kind` says which change. */
const ROLE_CHANGE_ACTION = "ROLE_CHANGE";

export async function getSystemRoles(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return sendError(res, 403, "FORBIDDEN", "Forbidden: ADMIN only");
    }

    const users = await prisma.user.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
      select: {
        userId: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { oauthIdentities: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    // Bare array for backward compatibility; extra fields are additive.
    return res.status(200).json(
      users.map(({ _count, createdAt, ...user }) => ({
        ...user,
        createdAt: createdAt.toISOString(),
        pendingRegistration: _count.oauthIdentities === 0,
        isSelf: user.userId === req.user?.userId,
      })),
    );
  } catch (error) {
    logger.error("Error fetching system roles:", error);
    return sendError(res, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
  }
}

class DecisionError extends Error {
  constructor(public decision: Extract<RoleChangeDecision, { ok: false }>) {
    super(decision.code);
  }
}

export async function upsertSystemRole(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return sendError(res, 403, "FORBIDDEN", "Forbidden: ADMIN only");
    }
    const actorId = req.user.userId;
    const { email, role } = req.body ?? {};
    const targetActive = req.body?.active === undefined ? true : req.body.active;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return sendError(res, 400, "INVALID_EMAIL", "A valid email is required");
    }
    if (!isStaffRole(role)) {
      return sendError(res, 400, "INVALID_ROLE", "Role must be ADMIN or FINANCE_CHECKER");
    }
    if (typeof targetActive !== "boolean") {
      return sendError(res, 400, "BAD_REQUEST", "active must be a boolean");
    }
    if (reason.length < MIN_REASON_LENGTH) {
      return sendError(res, 400, "REASON_REQUIRED", "A reason is required for every role change");
    }

    const emailLower = email.toLowerCase().trim();

    // Serializable so two admins cannot demote each other past the last-admin guard.
    const result = await prisma.$transaction(
      async (tx) => {
        const current = await tx.user.findUnique({
          where: { email: emailLower },
          select: { userId: true, role: true, isActive: true, email: true, displayName: true },
        });
        const otherActiveAdmins = await tx.user.count({
          where: {
            role: "ADMIN",
            isActive: true,
            ...(current ? { NOT: { userId: current.userId } } : {}),
          },
        });
        const decision = decideRoleChange({ actorId, current, targetRole: role, targetActive, otherActiveAdmins });
        if (!decision.ok) throw new DecisionError(decision);
        if (decision.kind === "UNCHANGED") return { user: current!, kind: decision.kind };

        const user = current
          ? await tx.user.update({
              where: { userId: current.userId },
              data: { role, isActive: targetActive },
              select: { userId: true, role: true, isActive: true, email: true, displayName: true },
            })
          : await tx.user.create({
              // Pre-provisioned staff account; bound on first Google login with this email.
              data: { email: emailLower, role, displayName: emailLower, isActive: true },
              select: { userId: true, role: true, isActive: true, email: true, displayName: true },
            });

        await tx.auditEvent.create({
          data: {
            actorId,
            action: ROLE_CHANGE_ACTION,
            entityType: "User",
            entityId: user.userId,
            payload: {
              email: emailLower,
              fromRole: current?.role ?? null,
              toRole: role,
              fromActive: current?.isActive ?? null,
              toActive: targetActive,
              kind: decision.kind,
              reason,
            },
          },
        });
        return { user, kind: decision.kind };
      },
      { isolationLevel: "Serializable" },
    );

    return res.status(200).json({
      userId: result.user.userId,
      email: result.user.email,
      displayName: result.user.displayName,
      role: result.user.role,
      isActive: result.user.isActive,
      change: result.kind,
    });
  } catch (error) {
    if (error instanceof DecisionError) {
      const { status, code, message } = error.decision;
      return sendError(res, status, code, message);
    }
    if ((error as { code?: string })?.code === "P2034") {
      return sendError(res, 409, "CONCURRENT_UPDATE", "Another role change happened at the same time. Try again.");
    }
    logger.error("Error upserting system role:", error);
    return sendError(res, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
  }
}
