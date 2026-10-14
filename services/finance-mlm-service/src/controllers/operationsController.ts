import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  activatePaidEnrollment,
  parsePaging,
  readReason,
  ReconciliationError,
  sendError,
} from "./reconciliationController";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXCEPTION_STATUSES = ["UNRESOLVED", "RESOLVED", "VOIDED"];

/**
 * Typed resolutions for an exception. Labels in the console must say exactly
 * this, nothing more:
 *  - ACTIVATE_ENROLLMENT: give access for an already SUCCESSFUL payment of
 *    this student+class (same state change as the payment webhook), then
 *    close the case. Refused when no successful payment exists.
 *  - MARK_RESOLVED: close the case after fixing it elsewhere (note required).
 *  - DISMISS: close as not actionable / duplicate (status VOIDED).
 * No resolution confirms a payment or moves money.
 */
export const EXCEPTION_RESOLUTIONS = ["ACTIVATE_ENROLLMENT", "MARK_RESOLVED", "DISMISS"] as const;
export type ExceptionResolution = (typeof EXCEPTION_RESOLUTIONS)[number];

export function statusForResolution(resolution: ExceptionResolution) {
  return resolution === "DISMISS" ? "VOIDED" : "RESOLVED";
}

/** Legacy path actions → typed resolutions (old console buttons). */
export function normalizeResolution(raw: unknown): ExceptionResolution | null {
  const value = String(raw ?? "").replace(/[\s-]+/g, "_").toUpperCase();
  if ((EXCEPTION_RESOLUTIONS as readonly string[]).includes(value)) return value as ExceptionResolution;
  if (value === "VOID" || value === "VOID_CANCEL") return "DISMISS";
  return null;
}

async function findPaymentContext(
  rows: { exceptionId: string; studentUserId: string | null; classId: string | null }[],
) {
  const pairs = rows.filter(
    (row) => row.studentUserId && row.classId && UUID_RE.test(row.classId),
  ) as { exceptionId: string; studentUserId: string; classId: string }[];
  if (pairs.length === 0) return new Map<string, PaymentContext>();

  const enrollments = await prisma.enrollment.findMany({
    where: {
      OR: pairs.map((p) => ({ studentUserId: p.studentUserId, classId: p.classId })),
    },
    select: { enrollmentId: true, studentUserId: true, classId: true, status: true, class: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
  const intents = enrollments.length
    ? await prisma.paymentIntent.findMany({
        where: { enrollmentId: { in: enrollments.map((e) => e.enrollmentId) }, enrollmentPackageId: null },
        select: { paymentIntentId: true, enrollmentId: true, status: true, amountMinor: true, providerRef: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const map = new Map<string, PaymentContext>();
  for (const pair of pairs) {
    const enrollment = enrollments.find(
      (e) => e.studentUserId === pair.studentUserId && e.classId === pair.classId,
    );
    if (!enrollment) {
      map.set(pair.exceptionId, { enrollmentId: null, enrollmentStatus: null, classTitle: null, payment: null, successfulPaymentId: null });
      continue;
    }
    const own = intents.filter((i) => i.enrollmentId === enrollment.enrollmentId);
    const success = own.find((i) => i.status === "SUCCESS");
    const latest = success ?? own[0];
    map.set(pair.exceptionId, {
      enrollmentId: enrollment.enrollmentId,
      enrollmentStatus: enrollment.status,
      classTitle: enrollment.class?.title ?? null,
      successfulPaymentId: success?.paymentIntentId ?? null,
      payment: latest
        ? {
            paymentIntentId: latest.paymentIntentId,
            status: latest.status,
            amountMinor: Number(latest.amountMinor),
            providerRef: latest.providerRef,
          }
        : null,
    });
  }
  return map;
}

interface PaymentContext {
  enrollmentId: string | null;
  enrollmentStatus: string | null;
  classTitle: string | null;
  successfulPaymentId: string | null;
  payment: { paymentIntentId: string; status: string; amountMinor: number; providerRef: string | null } | null;
}

export const getExceptions = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { status, type, q } = query;
    const { page, pageSize, skip } = parsePaging(query);
    const where: Prisma.ExceptionWhereInput = {};

    if (status && status !== "ALL") {
      if (!EXCEPTION_STATUSES.includes(status)) {
        return sendError(req, res, 400, "INVALID_STATUS_FILTER", "Unknown exception status");
      }
      where.status = status;
    }
    if (type && type !== "ALL") where.type = type;

    if (q?.trim()) {
      const search = q.trim();
      where.OR = [
        ...(UUID_RE.test(search) ? [{ exceptionId: search }, { studentUserId: search }] : []),
        { type: { contains: search, mode: "insensitive" } },
        { studentName: { contains: search, mode: "insensitive" } },
        { classId: { contains: search, mode: "insensitive" } },
        { provider: { contains: search, mode: "insensitive" } },
        { errorDetail: { contains: search, mode: "insensitive" } },
      ];
    }

    const [exceptions, total, statusGroups, typeGroups] = await Promise.all([
      prisma.exception.findMany({
        where,
        orderBy: { createdAt: query.order === "asc" ? "asc" : "desc" },
        skip,
        take: pageSize,
      }),
      prisma.exception.count({ where }),
      prisma.exception.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.exception.groupBy({ by: ["type"], _count: { _all: true } }),
    ]);

    const ids = exceptions.map((item) => item.exceptionId);
    const [context, resolutions] = await Promise.all([
      findPaymentContext(exceptions),
      ids.length
        ? prisma.auditEvent.findMany({
            where: { entityType: "Exception", entityId: { in: ids } },
            orderBy: { createdAt: "desc" },
          })
        : [],
    ]);
    const actorIds = [...new Set(resolutions.map((r) => r.actorId).filter((id) => UUID_RE.test(id)))];
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { userId: { in: actorIds } },
          select: { userId: true, displayName: true, email: true },
        })
      : [];
    const actorName = new Map(actors.map((a) => [a.userId, a.displayName || a.email || null]));

    res.status(200).json({
      exceptions: exceptions.map((item) => {
        const audit = resolutions.find((r) => r.entityId === item.exceptionId);
        const payload = (audit?.payload ?? {}) as Record<string, unknown>;
        const ctx = context.get(item.exceptionId) ?? null;
        return {
          id: item.exceptionId,
          type: item.type,
          studentUserId: item.studentUserId,
          studentName: item.studentName,
          classId: item.classId,
          provider: item.provider,
          amountMinor:
            item.amountMinor == null ? null : Number(item.amountMinor),
          status: item.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          errorDetail: item.errorDetail ?? "",
          context: ctx,
          canActivateEnrollment:
            item.status === "UNRESOLVED" && Boolean(ctx?.successfulPaymentId) && ctx?.enrollmentStatus !== "ACTIVE",
          lastAction: audit
            ? {
                action: audit.action,
                resolution: typeof payload.resolution === "string" ? payload.resolution : null,
                note:
                  typeof payload.note === "string"
                    ? payload.note
                    : typeof payload.reason === "string"
                      ? payload.reason
                      : null,
                actorId: audit.actorId,
                actorName: actorName.get(audit.actorId) ?? null,
                at: audit.createdAt,
              }
            : null,
        };
      }),
      total,
      page,
      pageSize,
      counts: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
      typeCounts: Object.fromEntries(typeGroups.map((g) => [g.type, g._count._all])),
    });
  } catch (error) {
    logger.error("Get Exceptions Error:", error);
    sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not fetch exceptions");
  }
};

/**
 * POST /v1/operations/exceptions/:id/resolve  { resolution, note }
 * (also reachable as /:id/:action for the legacy VOID_CANCEL path; the old
 * FORCE_ACTIVE action is rejected because it never activated anything).
 */
export const resolveException = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { id, action } = req.params;
  const actorId = req.user?.userId || "SYSTEM";

  try {
    const pathAction = String(action ?? "resolve").toLowerCase();
    const body = (req.body ?? {}) as { resolution?: unknown };
    const resolution =
      pathAction === "resolve" ? normalizeResolution(body.resolution) : normalizeResolution(action);
    if (!resolution) {
      return sendError(
        req,
        res,
        400,
        "UNSUPPORTED_EXCEPTION_ACTION",
        `resolution must be one of ${EXCEPTION_RESOLUTIONS.join(", ")}`,
      );
    }
    const note = readReason(req.body);
    if (!UUID_RE.test(id)) return sendError(req, res, 400, "BAD_REQUEST", "Invalid exception id");

    const current = await prisma.exception.findUnique({
      where: { exceptionId: id },
    });
    if (!current) {
      return sendError(req, res, 404, "NOT_FOUND", "Exception not found");
    }
    const newStatus = statusForResolution(resolution);
    if (current.status !== "UNRESOLVED") {
      // Idempotent retry of the same outcome; anything else is a conflict.
      if (current.status === newStatus) {
        return res.status(200).json({ success: true, changed: false, status: current.status });
      }
      return sendError(req, res, 409, "EXCEPTION_ALREADY_CLOSED", "Exception is already closed", {
        status: current.status,
      });
    }

    let activation: Awaited<ReturnType<typeof activatePaidEnrollment>> | null = null;
    if (resolution === "ACTIVATE_ENROLLMENT") {
      const ctx = (await findPaymentContext([current])).get(id);
      if (!ctx?.enrollmentId) {
        return sendError(req, res, 409, "ENROLLMENT_TARGET_NOT_FOUND", "No enrollment found for this student and class");
      }
      if (!ctx.successfulPaymentId) {
        return sendError(
          req,
          res,
          409,
          "NO_SUCCESSFUL_PAYMENT",
          "No successful payment exists for this enrollment; verify the payment first",
          { payment: ctx.payment },
        );
      }
      activation = await activatePaidEnrollment(ctx.successfulPaymentId, actorId, note, `EXCEPTION:${id}`);
    }

    const changed = await prisma.$transaction(async (tx) => {
      const claimed = await tx.exception.updateMany({
        where: { exceptionId: id, status: "UNRESOLVED" },
        data: { status: newStatus, updatedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      await tx.auditEvent.create({
        data: {
          actorId,
          action: `EXCEPTION_${resolution}`,
          entityType: "Exception",
          entityId: id,
          payload: {
            resolution,
            note,
            previousStatus: current.status,
            newStatus,
            exceptionType: current.type,
            ...(activation
              ? {
                  paymentIntentId: activation.paymentIntentId,
                  enrollmentTarget: activation.target,
                  enrollmentTargetId: activation.targetId,
                  enrollmentPreviousStatus: activation.previousStatus,
                  enrollmentChanged: activation.changed,
                }
              : {}),
          },
        },
      });
      return true;
    });

    res.status(200).json({
      success: true,
      changed,
      status: newStatus,
      resolution,
      activation,
    });
  } catch (error) {
    if (error instanceof ReconciliationError) {
      return sendError(req, res, error.status, error.code, error.message, error.details);
    }
    logger.error("Resolve Exception Error:", error);
    sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Could not update exception");
  }
};

export const getUnresolvedLinks = async (
  _req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const links = await prisma.unresolvedLegacyLink.findMany({
      orderBy: [{ hits: "desc" }, { lastSeen: "desc" }],
      take: 100,
    });

    res.status(200).json({
      links: links.map((link) => ({
        url: link.url,
        hits: link.hits,
        lastSeen: link.lastSeen,
      })),
    });
  } catch (error) {
    logger.error("Get Unresolved Links Error:", error);
    res.status(500).json({ error: "Could not fetch unresolved links" });
  }
};

export const getMappings = async (
  _req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const mappings = await prisma.legacyLinkMapping.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.status(200).json({
      mappings: mappings.map((mapping) => ({
        id: mapping.mappingId,
        source: mapping.sourceUrl,
        target: mapping.targetPath,
        created: mapping.createdAt.toISOString().split("T")[0],
        createdAt: mapping.createdAt,
      })),
    });
  } catch (error) {
    logger.error("Get Legacy Mappings Error:", error);
    res.status(500).json({ error: "Could not fetch legacy mappings" });
  }
};

export const createMapping = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { source, target } = req.body as {
    source?: string;
    target?: string;
  };

  if (!source?.trim() || !target?.trim()) {
    return res.status(400).json({ error: "source and target are required" });
  }

  try {
    const mapping = await prisma.legacyLinkMapping.upsert({
      where: { sourceUrl: source.trim() },
      update: { targetPath: target.trim() },
      create: {
        sourceUrl: source.trim(),
        targetPath: target.trim(),
      },
    });

    await prisma.unresolvedLegacyLink.deleteMany({
      where: { url: source.trim() },
    });

    res.status(201).json({
      success: true,
      mapping: {
        id: mapping.mappingId,
        source: mapping.sourceUrl,
        target: mapping.targetPath,
        created: mapping.createdAt.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    logger.error("Create Legacy Mapping Error:", error);
    res.status(500).json({ error: "Could not save legacy mapping" });
  }
};

export const deleteMapping = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { id } = req.params;

  try {
    await prisma.legacyLinkMapping.delete({ where: { mappingId: id } });
    res.status(200).json({ success: true, message: "Mapping deleted" });
  } catch (error) {
    logger.error("Delete Legacy Mapping Error:", error);
    res.status(500).json({ error: "Could not delete legacy mapping" });
  }
};
