import { logger } from "@tutor-advantage/shared-config";
import { Request, Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { syncDisputesAndRefunds } from "../services/paymentRiskService";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /v1/internal/payments/sync-disputes
 * Daily safety net called by Cloud Scheduler (X-Internal-Key, not JWT):
 * pulls disputes (chargebacks) and refunds from Omise so a missed webhook
 * can never leave one unnoticed.
 */
export async function syncDisputesInternal(req: Request, res: Response) {
  const internalKey = process.env.INTERNAL_API_KEY;
  const providedKey = req.headers["x-internal-key"];
  if (!internalKey || providedKey !== internalKey) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid internal key" },
    });
  }

  const rawDays = Number((req.body as { sinceDays?: unknown } | undefined)?.sinceDays ?? 45);
  const sinceDays = Number.isInteger(rawDays) && rawDays >= 1 && rawDays <= 400 ? rawDays : 45;

  try {
    const summary = await syncDisputesAndRefunds({ sinceDays });
    logger.info(`[PaymentRisk] Daily dispute/refund sync: ${JSON.stringify(summary)}`);
    return res.status(200).json({ message: "Dispute and refund sync finished", sinceDays, ...summary });
  } catch (error_err) {
    const error = error_err as Error;
    logger.error("[PaymentRisk] Daily sync failed:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Dispute sync failed", details: error.message },
    });
  }
}

/**
 * PATCH /v1/users/:id/card-payments-trust { trusted: boolean, reason }
 * ADMIN only. A trusted tutor is exempt from the new-tutor card limit.
 */
export async function updateCardPaymentsTrust(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const body = (req.body ?? {}) as { trusted?: unknown; reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!UUID_RE.test(id)) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid user id", requestId: req.id } });
  }
  if (typeof body.trusted !== "boolean") {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "trusted must be true or false", requestId: req.id } });
  }
  if (reason.length < 3) {
    return res.status(400).json({ error: { code: "REASON_REQUIRED", message: "A reason is required", requestId: req.id } });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: { userId: true, role: true, settings: true },
    });
    if (!user) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found", requestId: req.id } });
    }
    if (user.role !== "TUTOR") {
      return res.status(409).json({ error: { code: "NOT_A_TUTOR", message: "Only tutors can be trusted for card payments", requestId: req.id } });
    }

    const settings =
      user.settings && typeof user.settings === "object" && !Array.isArray(user.settings)
        ? (user.settings as Record<string, unknown>)
        : {};
    await prisma.$transaction([
      prisma.user.update({
        where: { userId: id },
        data: { settings: { ...settings, cardPaymentsTrusted: body.trusted }, updatedAt: new Date() },
      }),
      prisma.auditEvent.create({
        data: {
          actorId: req.user?.userId || "SYSTEM",
          action: "CARD_PAYMENTS_TRUST",
          entityType: "User",
          entityId: id,
          payload: { trusted: body.trusted, reason },
        },
      }),
    ]);

    return res.status(200).json({ success: true, userId: id, cardPaymentsTrusted: body.trusted });
  } catch (error) {
    logger.error("Update card payments trust error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Could not update card trust", requestId: req.id } });
  }
}
