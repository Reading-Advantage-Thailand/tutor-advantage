"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const shared_config_1 = require("@tutor-advantage/shared-config");
const authController_1 = require("./controllers/authController");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Shared Middlewares
app.use(shared_config_1.requestIdMiddleware);
app.use(shared_config_1.requestLoggerMiddleware);
// Health Check Endpoint
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "identity-service",
        timestamp: new Date().toISOString(),
    });
});
// Version Endpoint
app.get("/version", (req, res) => {
    res.status(200).json({ version: "1.0.0", service: "identity-service" }); // Read from package.json in real implementation
});
// OAuth Callback Endpoint
app.post("/v1/auth/callback", authController_1.handleOAuthCallback);
// Root API
app.get("/", (req, res) => {
    res.send("Identity Service API");
});
// Error handling middleware (Must be last)
app.use(shared_config_1.errorHandlerMiddleware);
const port = process.env.PORT || 3001;
app.listen(port, () => {
    shared_config_1.logger.info(`Identity Service running on port ${port}`);
});
