"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const database_1 = require("@tutor-advantage/database");
const shared_config_1 = require("@tutor-advantage/shared-config");
// Load root .env file
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../../../.env") });
shared_config_1.logger.info(`[Finance] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);
const authMiddleware_1 = require("./middlewares/authMiddleware");
const paymentController_1 = require("./controllers/paymentController");
const transferWebhookController_1 = require("./controllers/transferWebhookController");
const settlementController_1 = require("./controllers/settlementController");
const auditMiddleware_1 = require("./middlewares/auditMiddleware");
const auditController_1 = require("./controllers/auditController");
const adjustmentController_1 = require("./controllers/adjustmentController");
const operationsController_1 = require("./controllers/operationsController");
const userController_1 = require("./controllers/userController");
const fraudController_1 = require("./controllers/fraudController");
const adminController_1 = require("./controllers/adminController");
const couponController_1 = require("./controllers/couponController");
const devController_1 = require("./controllers/devController");
const tutorEarningsController_1 = require("./controllers/tutorEarningsController");
const tutorNetworkController_1 = require("./controllers/tutorNetworkController");
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    shared_config_1.logger.error("FATAL: JWT_SECRET must be set in production");
    process.exit(1);
}
const app = (0, express_1.default)();
const port = process.env.PORT || 3003;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3005").split(",").map((o) => o.trim());
const ALLOWED_ORIGIN_PATTERNS = [
    /^https?:\/\/.*\.ngrok-free\.app$/,
    /^https?:\/\/.*\.ngrok-free\.dev$/,
    /^https?:\/\/.*\.ngrok\.io$/,
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow server-to-server calls (no origin header) and whitelisted origins
        if (!origin)
            return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin))
            return callback(null, true);
        if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin)))
            return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString("utf8");
    },
}));
// Apply shared middleware
app.use(shared_config_1.requestIdMiddleware);
app.use(shared_config_1.requestLoggerMiddleware);
// Base endpoints — health check verifies DB connectivity
app.get("/health", async (_req, res) => {
    try {
        await database_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({ status: "ok", service: "finance-mlm-service" });
    }
    catch {
        res.status(503).json({ status: "error", service: "finance-mlm-service", reason: "db_unreachable" });
    }
});
app.get("/version", (_req, res) => {
    res.status(200).json({ version: "1.0.0", service: "finance-mlm-service" });
});
app.get("/v1/admin/overview", authMiddleware_1.authMiddleware, adminController_1.getAdminOverview);
// ── Coupon Routes (admin) ──────────────────────────────────────────────────
app.post("/v1/coupons", authMiddleware_1.authMiddleware, couponController_1.createCoupon);
app.get("/v1/coupons", authMiddleware_1.authMiddleware, couponController_1.getCoupons);
app.post("/v1/coupons/:couponId/void", authMiddleware_1.authMiddleware, couponController_1.voidCoupon);
// ── Payment Routes ─────────────────────────────────────────────────────────
app.post("/v1/payments/intent", authMiddleware_1.authMiddleware, paymentController_1.createPaymentIntent);
app.post("/v1/payments/confirm-mock", authMiddleware_1.authMiddleware, paymentController_1.confirmMockPayment);
app.get("/v1/payments/config", authMiddleware_1.authMiddleware, paymentController_1.getPaymentConfig);
app.get("/v1/payments/:paymentIntentId/qr-code", authMiddleware_1.authMiddleware, paymentController_1.getPromptPayQrCode);
app.get("/v1/payments/:paymentIntentId/status", authMiddleware_1.authMiddleware, paymentController_1.getPaymentStatus);
app.get("/v1/payments/history", authMiddleware_1.authMiddleware, paymentController_1.getPaymentHistory);
app.post("/v1/payments/webhook", paymentController_1.handleWebhook);
app.post("/v1/webhooks/omise-transfer", transferWebhookController_1.handleTransferWebhook);
const tutorSalesExportController_1 = require("./controllers/tutorSalesExportController");
// ── Tutor Dashboard Routes ─────────────────────────────────────────────────
app.get("/v1/tutors/earnings/summary", authMiddleware_1.authMiddleware, tutorEarningsController_1.getEarningsSummary);
app.get("/v1/tutors/earnings/history", authMiddleware_1.authMiddleware, tutorEarningsController_1.getEarningsHistory);
app.get("/v1/tutors/earnings/sales-csv", authMiddleware_1.authMiddleware, tutorSalesExportController_1.exportTutorSalesCsv);
app.post("/v1/tutors/earnings/transfers/:payoutLineId/sync", authMiddleware_1.authMiddleware, tutorEarningsController_1.syncTutorTransfer);
app.get("/v1/tutors/network", authMiddleware_1.authMiddleware, tutorNetworkController_1.getTutorNetwork);
// ── Internal Routes (protected by X-Internal-Key, NOT JWT) ────────────────
// Called by Google Cloud Scheduler — no authMiddleware
app.post("/v1/internal/settlement/auto-run", settlementController_1.autoRunSettlement);
// ── Settlement Routes ──────────────────────────────────────────────────────
// NOTE: /summary ต้องอยู่ก่อน /:snapshotId เพื่อไม่ให้ express match "summary" เป็น param
app.get("/v1/settlements/summary", authMiddleware_1.authMiddleware, settlementController_1.getSettlementSummary);
app.get("/v1/settlements", authMiddleware_1.authMiddleware, settlementController_1.getSettlements);
app.post("/v1/settlements/preview", authMiddleware_1.authMiddleware, (0, auditMiddleware_1.auditTrailMiddleware)("PREVIEW_SETTLEMENT"), settlementController_1.previewSettlement);
app.post("/v1/settlements/:snapshotId/refresh", authMiddleware_1.authMiddleware, (0, auditMiddleware_1.auditTrailMiddleware)("SETTLEMENT_REFRESH"), settlementController_1.refreshSettlement);
app.post("/v1/settlements/:snapshotId/submit", authMiddleware_1.authMiddleware, (0, auditMiddleware_1.auditTrailMiddleware)("SUBMIT_SETTLEMENT"), settlementController_1.submitSettlement);
app.post("/v1/settlements/:snapshotId/approve", authMiddleware_1.authMiddleware, (0, auditMiddleware_1.auditTrailMiddleware)("APPROVE_SETTLEMENT"), settlementController_1.approveSettlement);
app.post("/v1/settlements/:snapshotId/reject", authMiddleware_1.authMiddleware, settlementController_1.rejectSettlement);
app.get("/v1/settlements/:snapshotId/lines", authMiddleware_1.authMiddleware, settlementController_1.getSettlementLines);
app.post("/v1/settlements/:snapshotId/lines/:payoutLineId/transfer", authMiddleware_1.authMiddleware, (0, auditMiddleware_1.auditTrailMiddleware)("RETRY_PAYOUT_TRANSFER"), settlementController_1.retryPayoutTransfer);
app.post("/v1/settlements/:snapshotId/lines/:payoutLineId/sync-transfer", authMiddleware_1.authMiddleware, settlementController_1.syncPayoutTransfer);
app.get("/v1/settlements/:snapshotId/export", authMiddleware_1.authMiddleware, settlementController_1.exportSettlementCsv);
// ── Adjustment Routes ──────────────────────────────────────────────────────
app.get("/v1/adjustments", authMiddleware_1.authMiddleware, adjustmentController_1.getAdjustments);
app.post("/v1/adjustments", authMiddleware_1.authMiddleware, adjustmentController_1.createAdjustment);
app.post("/v1/adjustments/:adjustmentId/approve", authMiddleware_1.authMiddleware, adjustmentController_1.approveAdjustment);
app.post("/v1/adjustments/:adjustmentId/reject", authMiddleware_1.authMiddleware, adjustmentController_1.rejectAdjustment);
app.get("/v1/audit-logs", authMiddleware_1.authMiddleware, auditController_1.getAuditLogs);
// ── Operations Routes ──────────────────────────────────────────────────────
app.get("/v1/operations/exceptions", authMiddleware_1.authMiddleware, operationsController_1.getExceptions);
app.post("/v1/operations/exceptions/:id/:action", authMiddleware_1.authMiddleware, operationsController_1.resolveException);
app.get("/v1/operations/legacy-links/unresolved", authMiddleware_1.authMiddleware, operationsController_1.getUnresolvedLinks);
app.get("/v1/operations/legacy-links/mappings", authMiddleware_1.authMiddleware, operationsController_1.getMappings);
app.post("/v1/operations/legacy-links/mappings", authMiddleware_1.authMiddleware, operationsController_1.createMapping);
app.delete("/v1/operations/legacy-links/mappings/:id", authMiddleware_1.authMiddleware, operationsController_1.deleteMapping);
// ── Users Routes ───────────────────────────────────────────────────────────
app.get("/v1/users", authMiddleware_1.authMiddleware, userController_1.getUsers);
app.get("/v1/users/:id", authMiddleware_1.authMiddleware, userController_1.getUserDetails);
app.post("/v1/users/:id/verify", authMiddleware_1.authMiddleware, userController_1.verifyUser);
app.post("/v1/users/:id/suspend", authMiddleware_1.authMiddleware, userController_1.suspendUser);
app.post("/v1/users/:id/anonymize", authMiddleware_1.authMiddleware, userController_1.anonymizeUser);
app.patch("/v1/users/:id/omise-recipient", authMiddleware_1.authMiddleware, userController_1.updateOmiseRecipient);
// ── Fraud Routes ───────────────────────────────────────────────────────────
app.get("/v1/fraud-flags", authMiddleware_1.authMiddleware, fraudController_1.getFraudFlags);
app.post("/v1/fraud-flags/:id/action", authMiddleware_1.authMiddleware, fraudController_1.triggerFraudAction);
// ── Dev-only Routes (blocked in production) ────────────────────────────────
const devOnly = (_req, res, next) => {
    if (process.env.NODE_ENV === "production") {
        return res.status(404).json({ error: "Not found" });
    }
    next();
};
// User CRUD
app.get("/v1/dev/users", devOnly, devController_1.devListUsers);
app.post("/v1/dev/users", devOnly, devController_1.devCreateUser);
app.patch("/v1/dev/users/:id", devOnly, devController_1.devUpdateUser);
app.delete("/v1/dev/users/:id", devOnly, devController_1.devDeleteUser);
// State & Actions
app.get("/v1/dev/state", devOnly, devController_1.devGetState);
app.post("/v1/dev/actions/settlement", devOnly, devController_1.devRunSettlement);
app.post("/v1/dev/actions/fraud-flag", devOnly, devController_1.devSeedFraudFlag);
app.delete("/v1/dev/actions/fraud-flag/:id", devOnly, devController_1.devDeleteFraudFlag);
app.post("/v1/dev/actions/adjustment", devOnly, devController_1.devSeedAdjustment);
app.post("/v1/dev/actions/purge", devOnly, devController_1.devPurge);
// Tutor simulation
app.get("/v1/dev/tutor-badges/:tutorUserId", devOnly, devController_1.devGetTutorBadges);
app.post("/v1/dev/actions/add-volume", devOnly, devController_1.devAddVolume);
app.post("/v1/dev/actions/toggle-badge", devOnly, devController_1.devToggleBadge);
// Apply error handler last
app.use(shared_config_1.errorHandlerMiddleware);
const server = app.listen(port, () => {
    shared_config_1.logger.info(`Finance & MLM Service running on port ${port}`);
});
// Graceful shutdown — drain connections then disconnect DB
const shutdown = (signal) => async () => {
    shared_config_1.logger.info(`[Finance] ${signal} received — shutting down gracefully`);
    server.close(async () => {
        await database_1.prisma.$disconnect();
        shared_config_1.logger.info("[Finance] Shutdown complete");
        process.exit(0);
    });
    setTimeout(() => {
        shared_config_1.logger.error("[Finance] Shutdown timeout — forcing exit");
        process.exit(1);
    }, 10_000).unref();
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
