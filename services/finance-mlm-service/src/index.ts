import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { prisma } from "@tutor-advantage/database";

import {
  requestLoggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
  areDevRoutesEnabled,
  assertProductionSecurityConfig,
  getAllowedOrigins,
  isOriginAllowed,
  logger,
  createOpenApiMiddleware,
  openApiValidationErrorHandler,
} from "@tutor-advantage/shared-config";

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
logger.info(`[Finance] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);

import { authMiddleware, requireRoles } from "./middlewares/authMiddleware";
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
  refreshSettlement,
  submitSettlement,
  approveSettlement,
  rejectSettlement,
  exportSettlementCsv,
  getSettlementLines,
  getSettlementSummary,
  getSettlements,
  autoRunSettlement,
  retryPayoutTransfer,
  syncPayoutTransfer,
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
  createCoupon,
  getCoupons,
  voidCoupon,
} from "./controllers/couponController";
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
  devGetTutorBadges,
  devAddVolume,
  devToggleBadge,
} from "./controllers/devController";
import { getEarningsSummary, getEarningsHistory, syncTutorTransfer } from "./controllers/tutorEarningsController";
import { getTutorNetwork } from "./controllers/tutorNetworkController";

const app = express();
const port = process.env.PORT || 3003;
assertProductionSecurityConfig();
const adminOnly = requireRoles("ADMIN");
const financeStaffOnly = requireRoles("ADMIN", "FINANCE_CHECKER");
const adjustmentStaffOnly = requireRoles(
  "ADMIN",
  "FINANCE_MAKER",
  "FINANCE_CHECKER",
);

const ALLOWED_ORIGINS = getAllowedOrigins();
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server calls (no origin header) and whitelisted origins
      if (isOriginAllowed(origin, ALLOWED_ORIGINS)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  }),
);

// Apply shared middleware
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(
  createOpenApiMiddleware(
    path.resolve(process.cwd(), "packages/contracts/openapi/finance-mlm.v1.yaml"),
  ),
);

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

app.get("/v1/admin/overview", authMiddleware, financeStaffOnly, getAdminOverview);

// ── Coupon Routes (admin) ──────────────────────────────────────────────────
app.post("/v1/coupons", authMiddleware, adminOnly, createCoupon);
app.get("/v1/coupons", authMiddleware, adminOnly, getCoupons);
app.post("/v1/coupons/:couponId/void", authMiddleware, adminOnly, voidCoupon);

// ── Payment Routes ─────────────────────────────────────────────────────────
app.post("/v1/payments/intent", paymentLimiter, authMiddleware, createPaymentIntent);
app.get("/v1/payments/config", authMiddleware, getPaymentConfig);
app.get("/v1/payments/:paymentIntentId/qr-code", authMiddleware, getPromptPayQrCode);
app.get("/v1/payments/:paymentIntentId/status", authMiddleware, getPaymentStatus);
app.get("/v1/payments/history", authMiddleware, getPaymentHistory);
app.post("/v1/payments/webhook", webhookLimiter, handleWebhook);
app.post("/v1/webhooks/omise-transfer", webhookLimiter, handleTransferWebhook);

import { exportTutorSalesCsv } from "./controllers/tutorSalesExportController";

// ── Tutor Dashboard Routes ─────────────────────────────────────────────────
app.get("/v1/tutors/earnings/summary", authMiddleware, getEarningsSummary);
app.get("/v1/tutors/earnings/history", authMiddleware, getEarningsHistory);
app.get("/v1/tutors/earnings/sales-csv", authMiddleware, exportTutorSalesCsv);
app.post("/v1/tutors/earnings/transfers/:payoutLineId/sync", authMiddleware, syncTutorTransfer);
app.get("/v1/tutors/network", authMiddleware, getTutorNetwork);

// ── Internal Routes (protected by X-Internal-Key, NOT JWT) ────────────────
// Called by Google Cloud Scheduler — no authMiddleware
app.post("/v1/internal/settlement/auto-run", autoRunSettlement);

// ── Settlement Routes ──────────────────────────────────────────────────────
// NOTE: /summary ต้องอยู่ก่อน /:snapshotId เพื่อไม่ให้ express match "summary" เป็น param
app.get("/v1/settlements/summary", authMiddleware, financeStaffOnly, getSettlementSummary);
app.get("/v1/settlements", authMiddleware, financeStaffOnly, getSettlements);

app.post(
  "/v1/settlements/preview",
  authMiddleware,
  financeStaffOnly,
  auditTrailMiddleware("PREVIEW_SETTLEMENT"),
  previewSettlement,
);

app.post(
  "/v1/settlements/:snapshotId/refresh",
  authMiddleware,
  financeStaffOnly,
  auditTrailMiddleware("SETTLEMENT_REFRESH"),
  refreshSettlement,
);

app.post(
  "/v1/settlements/:snapshotId/submit",
  authMiddleware,
  financeStaffOnly,
  auditTrailMiddleware("SUBMIT_SETTLEMENT"),
  submitSettlement,
);

app.post(
  "/v1/settlements/:snapshotId/approve",
  authMiddleware,
  financeStaffOnly,
  auditTrailMiddleware("APPROVE_SETTLEMENT"),
  approveSettlement,
);

app.post(
  "/v1/settlements/:snapshotId/reject",
  authMiddleware,
  financeStaffOnly,
  rejectSettlement,
);

app.get(
  "/v1/settlements/:snapshotId/lines",
  authMiddleware,
  financeStaffOnly,
  getSettlementLines,
);

app.post(
  "/v1/settlements/:snapshotId/lines/:payoutLineId/transfer",
  authMiddleware,
  financeStaffOnly,
  auditTrailMiddleware("RETRY_PAYOUT_TRANSFER"),
  retryPayoutTransfer,
);

app.post(
  "/v1/settlements/:snapshotId/lines/:payoutLineId/sync-transfer",
  authMiddleware,
  financeStaffOnly,
  syncPayoutTransfer,
);

app.get(
  "/v1/settlements/:snapshotId/export",
  authMiddleware,
  financeStaffOnly,
  exportSettlementCsv,
);

// ── Adjustment Routes ──────────────────────────────────────────────────────
app.get("/v1/adjustments", authMiddleware, adjustmentStaffOnly, getAdjustments);
app.post("/v1/adjustments", authMiddleware, adjustmentStaffOnly, createAdjustment);
app.post(
  "/v1/adjustments/:adjustmentId/approve",
  authMiddleware,
  adjustmentStaffOnly,
  approveAdjustment,
);
app.post(
  "/v1/adjustments/:adjustmentId/reject",
  authMiddleware,
  adjustmentStaffOnly,
  rejectAdjustment,
);

app.get("/v1/audit-logs", authMiddleware, financeStaffOnly, getAuditLogs);

// ── Operations Routes ──────────────────────────────────────────────────────
app.get("/v1/operations/exceptions", authMiddleware, financeStaffOnly, getExceptions);
app.post(
  "/v1/operations/exceptions/:id/:action",
  authMiddleware,
  financeStaffOnly,
  resolveException,
);

app.get(
  "/v1/operations/legacy-links/unresolved",
  authMiddleware,
  financeStaffOnly,
  getUnresolvedLinks,
);
app.get("/v1/operations/legacy-links/mappings", authMiddleware, financeStaffOnly, getMappings);
app.post("/v1/operations/legacy-links/mappings", authMiddleware, financeStaffOnly, createMapping);
app.delete(
  "/v1/operations/legacy-links/mappings/:id",
  authMiddleware,
  financeStaffOnly,
  deleteMapping,
);

// ── Users Routes ───────────────────────────────────────────────────────────
app.get("/v1/users", authMiddleware, financeStaffOnly, getUsers);
app.get("/v1/users/:id", authMiddleware, financeStaffOnly, getUserDetails);
app.post("/v1/users/:id/verify", authMiddleware, financeStaffOnly, verifyUser);
app.post("/v1/users/:id/suspend", authMiddleware, adminOnly, suspendUser);
app.post("/v1/users/:id/anonymize", authMiddleware, adminOnly, anonymizeUser);
app.patch("/v1/users/:id/omise-recipient", authMiddleware, adminOnly, updateOmiseRecipient);

// ── Fraud Routes ───────────────────────────────────────────────────────────
app.get("/v1/fraud-flags", authMiddleware, financeStaffOnly, getFraudFlags);
app.post("/v1/fraud-flags/:id/action", authMiddleware, financeStaffOnly, triggerFraudAction);

// ── Dev-only Routes (blocked in production) ────────────────────────────────
if (areDevRoutesEnabled()) {
  app.post("/v1/payments/confirm-mock", paymentLimiter, authMiddleware, adminOnly, confirmMockPayment);
  app.get("/v1/dev/users", authMiddleware, adminOnly, devListUsers);
  app.post("/v1/dev/users", authMiddleware, adminOnly, devCreateUser);
  app.patch("/v1/dev/users/:id", authMiddleware, adminOnly, devUpdateUser);
  app.delete("/v1/dev/users/:id", authMiddleware, adminOnly, devDeleteUser);
  app.get("/v1/dev/state", authMiddleware, adminOnly, devGetState);
  app.post("/v1/dev/actions/settlement", authMiddleware, adminOnly, devRunSettlement);
  app.post("/v1/dev/actions/fraud-flag", authMiddleware, adminOnly, devSeedFraudFlag);
  app.delete("/v1/dev/actions/fraud-flag/:id", authMiddleware, adminOnly, devDeleteFraudFlag);
  app.post("/v1/dev/actions/adjustment", authMiddleware, adminOnly, devSeedAdjustment);
  app.post("/v1/dev/actions/purge", authMiddleware, adminOnly, devPurge);
  app.get("/v1/dev/tutor-badges/:tutorUserId", authMiddleware, adminOnly, devGetTutorBadges);
  app.post("/v1/dev/actions/add-volume", authMiddleware, adminOnly, devAddVolume);
  app.post("/v1/dev/actions/toggle-badge", authMiddleware, adminOnly, devToggleBadge);
}

// Apply error handler last
app.use(openApiValidationErrorHandler);
app.use(errorHandlerMiddleware);

const server = app.listen(port, () => {
  logger.info(`Finance & MLM Service running on port ${port}`);
});

// Graceful shutdown — drain connections then disconnect DB
const shutdown = (signal: string) => async () => {
  logger.info(`[Finance] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("[Finance] Shutdown complete");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("[Finance] Shutdown timeout — forcing exit");
    process.exit(1);
  }, 10_000).unref();
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
