"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const shared_config_1 = require("@tutor-advantage/shared-config");
const authMiddleware_1 = require("./middlewares/authMiddleware");
const classController_1 = require("./controllers/classController");
const referralController_1 = require("./controllers/referralController");
const enrollmentController_1 = require("./controllers/enrollmentController");
const app = (0, express_1.default)();
const port = process.env.PORT || 3002;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Apply shared middleware
app.use(shared_config_1.requestIdMiddleware);
app.use(shared_config_1.requestLoggerMiddleware);
// Base endpoints
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "learning-service" });
});
app.get("/version", (req, res) => {
    res.status(200).json({ version: "1.0.0", service: "learning-service" });
});
// Protected Class Routes
app.post("/v1/classes", authMiddleware_1.authMiddleware, classController_1.createClass);
app.post("/v1/classes/:classId/close", authMiddleware_1.authMiddleware, classController_1.closeClass);
// Protected Referral Routes
app.post("/v1/referrals/generate", authMiddleware_1.authMiddleware, referralController_1.generateReferral);
// Protected Enrollment Route
app.post("/v1/enroll/:referralToken", authMiddleware_1.authMiddleware, enrollmentController_1.enrollStudent);
// Apply error handler last
app.use(shared_config_1.errorHandlerMiddleware);
app.listen(port, () => {
    console.log(`Learning Service running on port ${port}`);
});
