"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load root .env file
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../../../.env") });
console.log(`[Finance] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);
const shared_config_1 = require("@tutor-advantage/shared-config");
const authMiddleware_1 = require("./middlewares/authMiddleware");
const paymentController_1 = require("./controllers/paymentController");
const settlementController_1 = require("./controllers/settlementController");
const auditMiddleware_1 = require("./middlewares/auditMiddleware");
const auditController_1 = require("./controllers/auditController");
const adjustmentController_1 = require("./controllers/adjustmentController");
const operationsController_1 = require("./controllers/operationsController");
const userController_1 = require("./controllers/userController");
const fraudController_1 = require("./controllers/fraudController");
const tutorEarningsController_1 = require("./controllers/tutorEarningsController");
const tutorNetworkController_1 = require("./controllers/tutorNetworkController");
const app = (0, express_1.default)();
const port = process.env.PORT || 3003;
app.use((0, cors_1.default)());
app.use(express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString("utf8");
    },
}));
// Apply shared middleware
app.use(shared_config_1.requestIdMiddleware);
app.use(shared_config_1.requestLoggerMiddleware);
// Base endpoints
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "finance-mlm-service" });
});
app.get("/version", (req, res) => {
    res.status(200).json({ version: "1.0.0", service: "finance-mlm-service" });
});
// ── Payment Routes ─────────────────────────────────────────────────────────
app.post("/v1/payments/intent", authMiddleware_1.authMiddleware, paymentController_1.createPaymentIntent);
app.post("/v1/payments/confirm-mock", authMiddleware_1.authMiddleware, paymentController_1.confirmMockPayment);
app.get("/v1/payments/history", authMiddleware_1.authMiddleware, paymentController_1.getPaymentHistory);
app.post("/v1/payments/webhook", paymentController_1.handleWebhook);
// ── Tutor Dashboard Routes ─────────────────────────────────────────────────
app.get("/v1/tutors/earnings/summary", authMiddleware_1.authMiddleware, tutorEarningsController_1.getEarningsSummary);
app.get("/v1/tutors/earnings/history", authMiddleware_1.authMiddleware, tutorEarningsController_1.getEarningsHistory);
app.get("/v1/tutors/network", authMiddleware_1.authMiddleware, tutorNetworkController_1.getTutorNetwork);
// ── Settlement Routes ──────────────────────────────────────────────────────
// NOTE: /summary ต้องอยู่ก่อน /:snapshotId เพื่อไม่ให้ express match "summary" เป็น param
app.get("/v1/settlements/summary", authMiddleware_1.authMiddleware, settlementController_1.getSettlementSummary);
app.get("/v1/settlements", authMiddleware_1.authMiddleware, settlementController_1.getSettlements);
app.post("/v1/settlements/preview", authMiddleware_1.authMiddleware, (0, auditMiddleware_1.auditTrailMiddleware)("PREVIEW_SETTLEMENT"), settlementController_1.previewSettlement);
app.post("/v1/settlements/:snapshotId/approve", authMiddleware_1.authMiddleware, (0, auditMiddleware_1.auditTrailMiddleware)("APPROVE_SETTLEMENT"), settlementController_1.approveSettlement);
app.post("/v1/settlements/:snapshotId/reject", authMiddleware_1.authMiddleware, settlementController_1.rejectSettlement);
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
app.post("/v1/users/:id/anonymize", authMiddleware_1.authMiddleware, userController_1.anonymizeUser);
// ── Fraud Routes ───────────────────────────────────────────────────────────
app.get("/v1/fraud-flags", authMiddleware_1.authMiddleware, fraudController_1.getFraudFlags);
app.post("/v1/fraud-flags/:id/action", authMiddleware_1.authMiddleware, fraudController_1.triggerFraudAction);
// Apply error handler last
app.use(shared_config_1.errorHandlerMiddleware);
app.listen(port, () => {
    console.log(`Finance & MLM Service running on port ${port}`);
});
