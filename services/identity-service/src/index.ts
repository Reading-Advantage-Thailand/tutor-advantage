import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { prisma } from "@tutor-advantage/database";

import {
  requestLoggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
  logger,
} from "@tutor-advantage/shared-config";

// Load root .env file
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
  override: process.env.NODE_ENV !== "production",
});
logger.info(`[Identity] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);

import { handleOAuthCallback } from "./controllers/authController";
import { getSession } from "./controllers/sessionController";
import { getGuardianConsentStatus, submitGuardianConsent, submitUserConsent } from "./controllers/consentController";
import { getCurrentUser, submitVerification } from "./controllers/userController";
import { getSettings, updateSettings } from "./controllers/settingController";
import { uploadFile } from "./controllers/uploadController";
import { authMiddleware } from "./middlewares/authMiddleware";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

const app = express();

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "https://student-liff-1090865515742.asia-southeast1.run.app,https://resource-pushpin-tabby.ngrok-free.dev,http://localhost:3004,http://localhost:3005,http://localhost:3006"
).split(",").map((o) => o.trim());

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/.*\.ngrok-free\.app$/,
  /^https?:\/\/.*\.ngrok-free\.dev$/,
  /^https?:\/\/.*\.ngrok\.io$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin))) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
app.use(express.json());

// Apply shared middleware
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

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
app.post("/v1/auth/callback", handleOAuthCallback);

import { getSystemRoles, upsertSystemRole } from "./controllers/roleController";

// Protected Auth Routes
app.get("/v1/session", authMiddleware, getSession);
app.get("/v1/users/me", authMiddleware, getCurrentUser);
app.get("/v1/users/me/settings", authMiddleware, getSettings);
app.patch("/v1/users/me/settings", authMiddleware, updateSettings);
app.post("/v1/users/me/verification", authMiddleware, submitVerification);
app.post("/v1/upload", authMiddleware, upload.single("file"), uploadFile);
app.get("/v1/guardian/consent", authMiddleware, getGuardianConsentStatus);
app.post("/v1/guardian/consent", authMiddleware, submitGuardianConsent);
app.post("/v1/users/me/consents", authMiddleware, submitUserConsent);

// Admin Routes
app.get("/v1/admin/roles", authMiddleware, getSystemRoles);
app.post("/v1/admin/roles", authMiddleware, upsertSystemRole);

// Root API
app.get("/", (_req: Request, res: Response) => {
  res.send("Identity Service API");
});

// Error handling middleware (Must be last)
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
