import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
console.log(`[Finance] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);

import {
  requestLoggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
} from "@tutor-advantage/shared-config";
import { authMiddleware } from "./middlewares/authMiddleware";
import {
  createPaymentIntent,
  confirmMockPayment,
  handleWebhook,
  getPaymentHistory,
  getPaymentConfig,
  getPaymentStatus,
  getPromptPayQrCode,
} from "./controllers/paymentController";
import {
  previewSettlement,
  approveSettlement,
  rejectSettlement,
  exportSettlementCsv,
  getSettlementSummary,
  getSettlements,
} from "./controllers/settlementController";
import { auditTrailMiddleware } from "./middlewares/auditMiddleware";
import { getAuditLogs } from "./controllers/auditController";
import {
  getAdjustments,
  createAdjustment,
  approveAdjustment,
  rejectAdjustment,
} from "./controllers/adjustmentController";
import {
  getExceptions,
  resolveException,
  getUnresolvedLinks,
  getMappings,
  createMapping,
  deleteMapping,
} from "./controllers/operationsController";
import {
  getUsers,
  getUserDetails,
  verifyUser,
  anonymizeUser,
} from "./controllers/userController";
import {
  getFraudFlags,
  triggerFraudAction,
} from "./controllers/fraudController";
import { getAdminOverview } from "./controllers/adminController";
import { getEarningsSummary, getEarningsHistory } from "./controllers/tutorEarningsController";
import { getTutorNetwork } from "./controllers/tutorNetworkController";

const app = express();
const port = process.env.PORT || 3003;

app.use(cors());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  }),
);

// Apply shared middleware
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Base endpoints
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "finance-mlm-service" });
});

app.get("/version", (_req: Request, res: Response) => {
  res.status(200).json({ version: "1.0.0", service: "finance-mlm-service" });
});

app.get("/v1/admin/overview", authMiddleware, getAdminOverview);

// ── Payment Routes ─────────────────────────────────────────────────────────
app.post("/v1/payments/intent", authMiddleware, createPaymentIntent);
app.post("/v1/payments/confirm-mock", authMiddleware, confirmMockPayment);
app.get("/v1/payments/config", authMiddleware, getPaymentConfig);
app.get("/v1/payments/:paymentIntentId/qr-code", authMiddleware, getPromptPayQrCode);
app.get("/v1/payments/:paymentIntentId/status", authMiddleware, getPaymentStatus);
app.get("/v1/payments/history", authMiddleware, getPaymentHistory);
app.post("/v1/payments/webhook", handleWebhook);

// ── Tutor Dashboard Routes ─────────────────────────────────────────────────
app.get("/v1/tutors/earnings/summary", authMiddleware, getEarningsSummary);
app.get("/v1/tutors/earnings/history", authMiddleware, getEarningsHistory);
app.get("/v1/tutors/network", authMiddleware, getTutorNetwork);

// ── Settlement Routes ──────────────────────────────────────────────────────
// NOTE: /summary ต้องอยู่ก่อน /:snapshotId เพื่อไม่ให้ express match "summary" เป็น param
app.get("/v1/settlements/summary", authMiddleware, getSettlementSummary);
app.get("/v1/settlements", authMiddleware, getSettlements);

app.post(
  "/v1/settlements/preview",
  authMiddleware,
  auditTrailMiddleware("PREVIEW_SETTLEMENT"),
  previewSettlement,
);

app.post(
  "/v1/settlements/:snapshotId/approve",
  authMiddleware,
  auditTrailMiddleware("APPROVE_SETTLEMENT"),
  approveSettlement,
);

app.post(
  "/v1/settlements/:snapshotId/reject",
  authMiddleware,
  rejectSettlement,
);

app.get(
  "/v1/settlements/:snapshotId/export",
  authMiddleware,
  exportSettlementCsv,
);

// ── Adjustment Routes ──────────────────────────────────────────────────────
app.get("/v1/adjustments", authMiddleware, getAdjustments);
app.post("/v1/adjustments", authMiddleware, createAdjustment);
app.post(
  "/v1/adjustments/:adjustmentId/approve",
  authMiddleware,
  approveAdjustment,
);
app.post(
  "/v1/adjustments/:adjustmentId/reject",
  authMiddleware,
  rejectAdjustment,
);

app.get("/v1/audit-logs", authMiddleware, getAuditLogs);

// ── Operations Routes ──────────────────────────────────────────────────────
app.get("/v1/operations/exceptions", authMiddleware, getExceptions);
app.post(
  "/v1/operations/exceptions/:id/:action",
  authMiddleware,
  resolveException,
);

app.get(
  "/v1/operations/legacy-links/unresolved",
  authMiddleware,
  getUnresolvedLinks,
);
app.get("/v1/operations/legacy-links/mappings", authMiddleware, getMappings);
app.post("/v1/operations/legacy-links/mappings", authMiddleware, createMapping);
app.delete(
  "/v1/operations/legacy-links/mappings/:id",
  authMiddleware,
  deleteMapping,
);

// ── Users Routes ───────────────────────────────────────────────────────────
app.get("/v1/users", authMiddleware, getUsers);
app.get("/v1/users/:id", authMiddleware, getUserDetails);
app.post("/v1/users/:id/verify", authMiddleware, verifyUser);
app.post("/v1/users/:id/anonymize", authMiddleware, anonymizeUser);

// ── Fraud Routes ───────────────────────────────────────────────────────────
app.get("/v1/fraud-flags", authMiddleware, getFraudFlags);
app.post("/v1/fraud-flags/:id/action", authMiddleware, triggerFraudAction);

// Apply error handler last
app.use(errorHandlerMiddleware);

app.listen(port, () => {
  console.log(`Finance & MLM Service running on port ${port}`);
});
