import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { prisma } from "@tutor-advantage/database";

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
import { handleTransferWebhook } from "./controllers/transferWebhookController";
import {
  previewSettlement,
  submitSettlement,
  approveSettlement,
  rejectSettlement,
  exportSettlementCsv,
  getSettlementLines,
  getSettlementSummary,
  getSettlements,
  autoRunSettlement,
  retryPayoutTransfer,
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
  suspendUser,
  anonymizeUser,
  updateOmiseRecipient,
} from "./controllers/userController";
import {
  getFraudFlags,
  triggerFraudAction,
} from "./controllers/fraudController";
import { getAdminOverview } from "./controllers/adminController";
import {
  devListUsers,
  devCreateUser,
  devUpdateUser,
  devDeleteUser,
  devGetState,
  devRunSettlement,
  devSeedFraudFlag,
  devDeleteFraudFlag,
  devSeedAdjustment,
  devPurge,
} from "./controllers/devController";
import { getEarningsSummary, getEarningsHistory } from "./controllers/tutorEarningsController";
import { getTutorNetwork } from "./controllers/tutorNetworkController";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET must be set in production");
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3003;

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "http://localhost:3005"
).split(",").map((o) => o.trim());

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/.*\.ngrok-free\.app$/,
  /^https?:\/\/.*\.ngrok-free\.dev$/,
  /^https?:\/\/.*\.ngrok\.io$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server calls (no origin header) and whitelisted origins
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin))) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
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

// Base endpoints — health check verifies DB connectivity
app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", service: "finance-mlm-service" });
  } catch {
    res.status(503).json({ status: "error", service: "finance-mlm-service", reason: "db_unreachable" });
  }
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
app.post("/v1/webhooks/omise-transfer", handleTransferWebhook);

// ── Tutor Dashboard Routes ─────────────────────────────────────────────────
app.get("/v1/tutors/earnings/summary", authMiddleware, getEarningsSummary);
app.get("/v1/tutors/earnings/history", authMiddleware, getEarningsHistory);
app.get("/v1/tutors/network", authMiddleware, getTutorNetwork);

// ── Internal Routes (protected by X-Internal-Key, NOT JWT) ────────────────
// Called by Google Cloud Scheduler — no authMiddleware
app.post("/v1/internal/settlement/auto-run", autoRunSettlement);

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
  "/v1/settlements/:snapshotId/submit",
  authMiddleware,
  auditTrailMiddleware("SUBMIT_SETTLEMENT"),
  submitSettlement,
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
  "/v1/settlements/:snapshotId/lines",
  authMiddleware,
  getSettlementLines,
);

app.post(
  "/v1/settlements/:snapshotId/lines/:payoutLineId/transfer",
  authMiddleware,
  auditTrailMiddleware("RETRY_PAYOUT_TRANSFER"),
  retryPayoutTransfer,
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
app.post("/v1/users/:id/suspend", authMiddleware, suspendUser);
app.post("/v1/users/:id/anonymize", authMiddleware, anonymizeUser);
app.patch("/v1/users/:id/omise-recipient", authMiddleware, updateOmiseRecipient);

// ── Fraud Routes ───────────────────────────────────────────────────────────
app.get("/v1/fraud-flags", authMiddleware, getFraudFlags);
app.post("/v1/fraud-flags/:id/action", authMiddleware, triggerFraudAction);

// ── Dev-only Routes (blocked in production) ────────────────────────────────
const devOnly = (_req: Request, res: Response, next: () => void) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }
  next();
};
// User CRUD
app.get("/v1/dev/users", devOnly, devListUsers);
app.post("/v1/dev/users", devOnly, devCreateUser);
app.patch("/v1/dev/users/:id", devOnly, devUpdateUser);
app.delete("/v1/dev/users/:id", devOnly, devDeleteUser);
// State & Actions
app.get("/v1/dev/state", devOnly, devGetState);
app.post("/v1/dev/actions/settlement", devOnly, devRunSettlement);
app.post("/v1/dev/actions/fraud-flag", devOnly, devSeedFraudFlag);
app.delete("/v1/dev/actions/fraud-flag/:id", devOnly, devDeleteFraudFlag);
app.post("/v1/dev/actions/adjustment", devOnly, devSeedAdjustment);
app.post("/v1/dev/actions/purge", devOnly, devPurge);

// Apply error handler last
app.use(errorHandlerMiddleware);

const server = app.listen(port, () => {
  console.log(`Finance & MLM Service running on port ${port}`);
});

// Graceful shutdown — drain connections then disconnect DB
const shutdown = (signal: string) => async () => {
  console.log(`[Finance] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("[Finance] Shutdown complete");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[Finance] Shutdown timeout — forcing exit");
    process.exit(1);
  }, 10_000).unref();
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
