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
console.log(`[Identity] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);
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
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Apply shared middleware
app.use(shared_config_1.requestIdMiddleware);
app.use(shared_config_1.requestLoggerMiddleware);
// Health Check Endpoint
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "identity-service" });
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
app.post("/v1/guardian/consent", authMiddleware_1.authMiddleware, consentController_1.submitGuardianConsent);
// Root API
app.get("/", (_req, res) => {
    res.send("Identity Service API");
});
// Error handling middleware (Must be last)
app.use(shared_config_1.errorHandlerMiddleware);
const port = process.env.PORT || 3001;
app.listen(port, () => {
    shared_config_1.logger.info(`Identity Service running on port ${port}`);
});
