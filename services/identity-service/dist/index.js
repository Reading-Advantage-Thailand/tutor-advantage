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
// Load root .env file
dotenv_1.default.config({
    path: path_1.default.resolve(__dirname, "../../../.env"),
    override: process.env.NODE_ENV !== "production",
});
shared_config_1.logger.info(`[Identity] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);
const shared_config_1 = require("@tutor-advantage/shared-config");
const authController_1 = require("./controllers/authController");
const sessionController_1 = require("./controllers/sessionController");
const consentController_1 = require("./controllers/consentController");
const userController_1 = require("./controllers/userController");
const settingController_1 = require("./controllers/settingController");
const uploadController_1 = require("./controllers/uploadController");
const authMiddleware_1 = require("./middlewares/authMiddleware");
const multer_1 = __importDefault(require("multer"));
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});
const app = (0, express_1.default)();
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://student-liff-1090865515742.asia-southeast1.run.app,https://resource-pushpin-tabby.ngrok-free.dev,http://localhost:3004,http://localhost:3005,http://localhost:3006").split(",").map((o) => o.trim());
const ALLOWED_ORIGIN_PATTERNS = [
    /^https?:\/\/.*\.ngrok-free\.app$/,
    /^https?:\/\/.*\.ngrok-free\.dev$/,
    /^https?:\/\/.*\.ngrok\.io$/,
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
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
app.use(express_1.default.json());
// Apply shared middleware
app.use(shared_config_1.requestIdMiddleware);
app.use(shared_config_1.requestLoggerMiddleware);
// Health Check Endpoint — verifies DB connectivity
app.get("/health", async (_req, res) => {
    try {
        await database_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({ status: "ok", service: "identity-service" });
    }
    catch {
        res.status(503).json({ status: "error", service: "identity-service", reason: "db_unreachable" });
    }
});
// Version Endpoint
app.get("/version", (_req, res) => {
    res.status(200).json({ version: "1.0.0", service: "identity-service" }); // Read from package.json in real implementation
});
// OAuth Callback Endpoint
app.post("/v1/auth/callback", authController_1.handleOAuthCallback);
// Protected Auth Routes
app.get("/v1/session", authMiddleware_1.authMiddleware, sessionController_1.getSession);
app.get("/v1/users/me", authMiddleware_1.authMiddleware, userController_1.getCurrentUser);
app.get("/v1/users/me/settings", authMiddleware_1.authMiddleware, settingController_1.getSettings);
app.patch("/v1/users/me/settings", authMiddleware_1.authMiddleware, settingController_1.updateSettings);
app.post("/v1/users/me/verification", authMiddleware_1.authMiddleware, userController_1.submitVerification);
app.post("/v1/upload", authMiddleware_1.authMiddleware, upload.single("file"), uploadController_1.uploadFile);
app.get("/v1/guardian/consent", authMiddleware_1.authMiddleware, consentController_1.getGuardianConsentStatus);
app.post("/v1/guardian/consent", authMiddleware_1.authMiddleware, consentController_1.submitGuardianConsent);
// Root API
app.get("/", (_req, res) => {
    res.send("Identity Service API");
});
// Error handling middleware (Must be last)
app.use(shared_config_1.errorHandlerMiddleware);
const port = process.env.PORT || 3001;
const server = app.listen(port, () => {
    shared_config_1.logger.info(`Identity Service running on port ${port}`);
});
// Graceful shutdown — close HTTP server then disconnect DB
const shutdown = (signal) => async () => {
    shared_config_1.logger.info(`[Identity] ${signal} received — shutting down gracefully`);
    server.close(async () => {
        await database_1.prisma.$disconnect();
        shared_config_1.logger.info("[Identity] Shutdown complete");
        process.exit(0);
    });
    // Force-exit after 10 s if connections don't drain
    setTimeout(() => {
        shared_config_1.logger.error("[Identity] Shutdown timeout — forcing exit");
        process.exit(1);
    }, 10_000).unref();
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
