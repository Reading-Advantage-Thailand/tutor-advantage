"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditTrailMiddleware = auditTrailMiddleware;
const shared_config_1 = require("@tutor-advantage/shared-config");
const database_1 = require("@tutor-advantage/database");
const SENSITIVE_FIELDS = new Set([
    "password", "token", "secret", "cvv", "cardNumber", "pan",
    "bankAccount", "accountNumber", "privateKey", "accessToken", "refreshToken",
]);
function sanitizeBody(body) {
    if (!body || typeof body !== "object" || Array.isArray(body))
        return body;
    const sanitized = {};
    for (const [key, value] of Object.entries(body)) {
        sanitized[key] = SENSITIVE_FIELDS.has(key.toLowerCase()) ? "[REDACTED]" : value;
    }
    return sanitized;
}
function auditTrailMiddleware(actionName) {
    return (req, res, next) => {
        const originalJson = res.json;
        res.json = function (body) {
            res.json = originalJson;
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const userId = req.user?.userId;
                const targetId = req.params.snapshotId ||
                    req.body.enrollmentId ||
                    req.body.tutorUserId ||
                    "system";
                database_1.prisma.auditEvent
                    .create({
                    data: {
                        actorId: userId || "SYSTEM",
                        action: actionName,
                        entityType: "general_action",
                        entityId: targetId,
                        payload: {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            body: sanitizeBody(req.body),
                            params: req.params,
                            ip: req.ip,
                            timestamp: new Date().toISOString(),
                        },
                    },
                })
                    .catch((err) => shared_config_1.logger.error("Failed to write audit log:", err));
            }
            return res.json(body);
        };
        next();
    };
}
