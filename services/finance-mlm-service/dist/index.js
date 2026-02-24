"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const shared_config_1 = require("@tutor-advantage/shared-config");
const authMiddleware_1 = require("./middlewares/authMiddleware");
const paymentController_1 = require("./controllers/paymentController");
const app = (0, express_1.default)();
const port = process.env.PORT || 3003;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Apply shared middleware
app.use(shared_config_1.requestIdMiddleware);
app.use(shared_config_1.requestLoggerMiddleware);
// Base endpoints
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "finance-mlm-service" });
});
app.get("/version", (req, res) => {
    res.status(200).json({ version: "1.0.0", service: "finance-mlm-service" });
});
// Protected Payment Routes
app.post("/v1/payments/intent", authMiddleware_1.authMiddleware, paymentController_1.createPaymentIntent);
// Public Webhook Routes
app.post("/v1/payments/webhook", paymentController_1.handleWebhook);
// Apply error handler last
app.use(shared_config_1.errorHandlerMiddleware);
app.listen(port, () => {
    console.log(`Finance & MLM Service running on port ${port}`);
});
