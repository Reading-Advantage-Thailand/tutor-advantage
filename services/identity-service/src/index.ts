import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { prisma } from "@tutor-advantage/database";

import {
  requestLoggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
  assertProductionSecurityConfig,
  getAllowedOrigins,
  isOriginAllowed,
  logger,
  createOpenApiMiddleware,
  openApiValidationErrorHandler,
  forwardedClientIp,
  getJwtSecret,
  trustProxySetting,
  installProcessErrorHandlers,
} from "@tutor-advantage/shared-config";

// Load root .env file
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
  override: process.env.NODE_ENV !== "production",
});
// Log crashes and stray rejections at error level (Error Reporting + Discord).
installProcessErrorHandlers("identity-service");
import { handleOAuthCallback } from "./controllers/authController";
import { handleDevLogin } from "./controllers/devAuthController";
import { getSession, issueSocketToken } from "./controllers/sessionController";
import { getGuardianConsentStatus, submitGuardianConsent, submitUserConsent } from "./controllers/consentController";
import { getCurrentUser, submitVerification, updateCurrentUserProfile } from "./controllers/userController";
import { getSettings, updateSettings } from "./controllers/settingController";
import { uploadFile } from "./controllers/uploadController";
import { scanPassportPhoto } from "./controllers/passportScanController";
import { relayMonitoringAlert } from "./controllers/monitoringAlertController";
import { authMiddleware, requireRoles, type AuthenticatedRequest } from "./middlewares/authMiddleware";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    fields: 10,
    files: 1,
  },
});

const app = express();
assertProductionSecurityConfig();

app.set("trust proxy", trustProxySetting());

const ALLOWED_ORIGINS = getAllowedOrigins();
// Student and tutor logins come from the apps' servers, which forward the
// user's IP signed; counting the app's own IP would lock everyone out at once.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${ipKeyGenerator(forwardedClientIp(req.headers, getJwtSecret()) || req.ip || "unknown")}`,
});
// Mounted after authMiddleware: each user gets their own budget.
const perUserKey = (req: Request) => {
  const userId = (req as AuthenticatedRequest).user?.userId;
  return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip || "unknown")}`;
};
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: perUserKey,
});
// Each passport scan is a paid model call.
const passportScanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: perUserKey,
});

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, ALLOWED_ORIGINS)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

// Apply shared middleware
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(
  createOpenApiMiddleware(
    path.resolve(__dirname, "../../../packages/contracts/openapi/identity.v1.yaml"),
  ),
);

// Health Check Endpoint — verifies DB connectivity
app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", service: "identity-service" });
  } catch {
    res.status(503).json({ status: "error", service: "identity-service", reason: "db_unreachable" });
  }
});

// Version Endpoint
app.get("/version", (_req: Request, res: Response) => {
  res.status(200).json({ version: "1.0.0", service: "identity-service" }); // Read from package.json in real implementation
});

// OAuth Callback Endpoint
app.post("/v1/auth/callback", authLimiter, handleOAuthCallback);
if (process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_ROUTES === "true") {
  app.post("/v1/auth/dev", authLimiter, handleDevLogin);
}

import { getSystemRoles, upsertSystemRole } from "./controllers/roleController";

// Protected Auth Routes
app.get("/v1/session", authMiddleware, getSession);
app.get("/v1/auth/socket-token", authMiddleware, issueSocketToken);
app.get("/v1/users/me", authMiddleware, getCurrentUser);
app.patch("/v1/users/me/profile", authMiddleware, updateCurrentUserProfile);
app.get("/v1/users/me/settings", authMiddleware, getSettings);
app.patch("/v1/users/me/settings", authMiddleware, updateSettings);
app.post("/v1/users/me/verification", authMiddleware, submitVerification);
app.post("/v1/upload", authMiddleware, uploadLimiter, upload.single("file"), uploadFile);
app.post(
  "/v1/users/me/passport-scan",
  authMiddleware,
  passportScanLimiter,
  requireRoles("TUTOR"),
  upload.single("file"),
  scanPassportPhoto,
);
app.get("/v1/guardian/consent", authMiddleware, getGuardianConsentStatus);
app.post("/v1/guardian/consent", authMiddleware, submitGuardianConsent);
app.post("/v1/users/me/consents", authMiddleware, submitUserConsent);

// Cloud Monitoring alert relay → Discord (HTTP Basic auth with INTERNAL_API_KEY, NOT JWT)
app.post("/v1/internal/alerts/monitoring", relayMonitoringAlert);

// Admin Routes
app.get("/v1/admin/roles", authMiddleware, requireRoles("ADMIN"), getSystemRoles);
app.post("/v1/admin/roles", authMiddleware, requireRoles("ADMIN"), upsertSystemRole);

// Root API
app.get("/", (_req: Request, res: Response) => {
  res.send("Identity Service API");
});

// Error handling middleware (Must be last)
app.use(openApiValidationErrorHandler);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 3001;
const server = app.listen(port, () => {
  logger.info(`Identity Service running on port ${port}`);
});

// Graceful shutdown — close HTTP server then disconnect DB
const shutdown = (signal: string) => async () => {
  logger.info(`[Identity] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("[Identity] Shutdown complete");
    process.exit(0);
  });
  // Force-exit after 10 s if connections don't drain
  setTimeout(() => {
    logger.error("[Identity] Shutdown timeout — forcing exit");
    process.exit(1);
  }, 10_000).unref();
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
