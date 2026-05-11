import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
console.log(`[Identity] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);

import {
  requestLoggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
  logger,
} from "@tutor-advantage/shared-config";
import { handleOAuthCallback } from "./controllers/authController";
import { getSession } from "./controllers/sessionController";
import { submitGuardianConsent } from "./controllers/consentController";
import { getCurrentUser } from "./controllers/userController";
import { getSettings, updateSettings } from "./controllers/settingController";
import { authMiddleware } from "./middlewares/authMiddleware";

const app = express();
app.use(cors());
app.use(express.json());

// Apply shared middleware
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Health Check Endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "identity-service" });
});

// Version Endpoint
app.get("/version", (req: Request, res: Response) => {
  res.status(200).json({ version: "1.0.0", service: "identity-service" }); // Read from package.json in real implementation
});

// OAuth Callback Endpoint
app.post("/v1/auth/callback", handleOAuthCallback);

// Protected Auth Routes
app.get("/v1/session", authMiddleware, getSession);
app.get("/v1/users/me", authMiddleware, getCurrentUser);
app.get("/v1/users/me/settings", authMiddleware, getSettings);
app.patch("/v1/users/me/settings", authMiddleware, updateSettings);
app.post("/v1/guardian/consent", authMiddleware, submitGuardianConsent);

// Root API
app.get("/", (req: Request, res: Response) => {
  res.send("Identity Service API");
});

// Error handling middleware (Must be last)
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  logger.info(`Identity Service running on port ${port}`);
});
