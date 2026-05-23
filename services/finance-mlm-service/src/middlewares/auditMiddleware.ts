import { Response, NextFunction } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "./authMiddleware";

const SENSITIVE_FIELDS = new Set([
  "password", "token", "secret", "cvv", "cardNumber", "pan",
  "bankAccount", "accountNumber", "privateKey", "accessToken", "refreshToken",
]);

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    sanitized[key] = SENSITIVE_FIELDS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return sanitized;
}

export function auditTrailMiddleware(actionName: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function (body) {
      res.json = originalJson;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.userId;
        const targetId =
          req.params.snapshotId ||
          req.body.enrollmentId ||
          req.body.tutorUserId ||
          "system";

        prisma.auditEvent
          .create({
            data: {
              actorId: userId || "SYSTEM",
              action: actionName,
              entityType: "general_action",
              entityId: targetId,
              payload: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              body: sanitizeBody(req.body) as any,
                params: req.params,
                ip: req.ip,
                timestamp: new Date().toISOString(),
              },
            },
          })
          .catch((err) => console.error("Failed to write audit log:", err));
      }

      return res.json(body);
    };

    next();
  };
}
