import express, { Request, Response } from "express";
import cors from "cors";
import {
  requestLoggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
} from "@tutor-advantage/shared-config";
import { authMiddleware } from "./middlewares/authMiddleware";
import {
  createPaymentIntent,
  handleWebhook,
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

const app = express();
const port = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Apply shared middleware
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Base endpoints
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "finance-mlm-service" });
});

app.get("/version", (req: Request, res: Response) => {
  res.status(200).json({ version: "1.0.0", service: "finance-mlm-service" });
});

// ── Payment Routes ─────────────────────────────────────────────────────────
app.post("/v1/payments/intent", authMiddleware, createPaymentIntent);
app.post("/v1/payments/webhook", handleWebhook);

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

// ── Audit Routes ───────────────────────────────────────────────────────────
app.get("/v1/audit-logs", authMiddleware, getAuditLogs);

// Apply error handler last
app.use(errorHandlerMiddleware);

app.listen(port, () => {
  console.log(`Finance & MLM Service running on port ${port}`);
});
