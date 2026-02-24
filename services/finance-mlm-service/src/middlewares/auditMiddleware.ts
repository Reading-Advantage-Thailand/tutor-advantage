import { Request, Response, NextFunction } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "./authMiddleware";

/**
 * Middleware to log high-privilege actions (e.g., Maker/Checker approvals, manual adjustments)
 * This acts as an interceptor. In a real system, you might attach to Prisma middlewares
 * or emit events AFTER the controller successfully completes.
 * Here we use an interceptor approach that hooks into res.json to log IF the request succeeded.
 */
export function auditTrailMiddleware(actionName: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    // Override res.json to capture the response and log the action
    res.json = function (body) {
      res.json = originalJson; // Cleanup override

      // If the action was successful (e.g., 200, 201)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.userId;
        const targetId =
          req.params.snapshotId ||
          req.body.enrollmentId ||
          req.body.tutorUserId ||
          "system";

        // Fire-and-forget log writing
        prisma.auditEvent
          .create({
            data: {
              actorId: userId || "SYSTEM",
              action: actionName,
              entityType: "general_action",
              entityId: targetId,
              payload: {
                body: req.body,
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
