"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load the monorepo .env file from both ts-node src/ and compiled dist/ starts.
dotenv_1.default.config({
    path: path_1.default.resolve(__dirname, "../../../.env"),
    override: true,
});
console.log(`[Learning] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const shared_config_1 = require("@tutor-advantage/shared-config");
const authMiddleware_1 = require("./middlewares/authMiddleware");
const classController_1 = require("./controllers/classController");
const referralController_1 = require("./controllers/referralController");
const enrollmentController_1 = require("./controllers/enrollmentController");
const dashboardController_1 = require("./controllers/dashboardController");
const chatController_1 = require("./controllers/chatController");
const auctionController_1 = require("./controllers/auctionController");
const performanceController_1 = require("./controllers/performanceController");
const notificationsController_1 = require("./controllers/notificationsController");
const lessonHistoryController_1 = require("./controllers/lessonHistoryController");
const app = (0, express_1.default)();
const port = process.env.PORT || 3002;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Apply shared middleware
app.use(shared_config_1.requestIdMiddleware);
app.use(shared_config_1.requestLoggerMiddleware);
// Base endpoints
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "learning-service" });
});
app.get("/version", (_req, res) => {
    res.status(200).json({ version: "1.0.0", service: "learning-service" });
});
// Protected Class Routes
app.get("/v1/books", authMiddleware_1.authMiddleware, classController_1.getBooks);
app.post("/v1/classes", authMiddleware_1.authMiddleware, classController_1.createClass);
app.post("/v1/classes/:classId/close", authMiddleware_1.authMiddleware, classController_1.closeClass);
app.get("/v1/classes", authMiddleware_1.authMiddleware, classController_1.getClasses);
app.get("/v1/classes/available", authMiddleware_1.authMiddleware, classController_1.getAvailableClasses);
app.get("/v1/classes/:classId", authMiddleware_1.authMiddleware, classController_1.getClassById);
app.delete("/v1/classes/:classId", authMiddleware_1.authMiddleware, classController_1.deleteClass);
app.patch("/v1/classes/:classId/meeting-url", authMiddleware_1.authMiddleware, classController_1.updateMeetingUrl);
app.get("/v1/classes/:classId/articles", authMiddleware_1.authMiddleware, classController_1.getClassArticles);
// Protected Referral Routes
app.post("/v1/referrals/generate", authMiddleware_1.authMiddleware, referralController_1.generateReferral);
// Protected Enrollment Route
app.post("/v1/enroll/direct", authMiddleware_1.authMiddleware, enrollmentController_1.directEnroll);
app.post("/v1/enroll/:referralToken", authMiddleware_1.authMiddleware, enrollmentController_1.enrollStudent);
// Protected Dashboard API
app.get("/v1/dashboard/summary", authMiddleware_1.authMiddleware, dashboardController_1.getDashboardSummary);
app.get("/v1/student/progress", authMiddleware_1.authMiddleware, dashboardController_1.getStudentProgress);
// Protected Lesson History Routes
app.get("/v1/lessons/history", authMiddleware_1.authMiddleware, lessonHistoryController_1.getStudentLessonHistory);
app.get("/v1/lessons/history/:sessionId", authMiddleware_1.authMiddleware, lessonHistoryController_1.getLessonSessionDetails);
// Protected Chat Routes
app.get("/v1/chat/conversations", authMiddleware_1.authMiddleware, chatController_1.getConversations);
app.get("/v1/chat/conversations/:conversationId/messages", authMiddleware_1.authMiddleware, chatController_1.getMessages);
app.post("/v1/chat/conversations/:conversationId/messages", authMiddleware_1.authMiddleware, chatController_1.sendMessage);
app.post("/v1/chat/initiate", authMiddleware_1.authMiddleware, chatController_1.initiateChat);
// Protected Auction Routes
app.get("/v1/classes/auction", authMiddleware_1.authMiddleware, auctionController_1.getAuctionClasses);
app.post("/v1/classes/auction/:transferId/claim", authMiddleware_1.authMiddleware, auctionController_1.claimAuctionClass);
// Protected Performance Route
app.get("/v1/tutors/performance", authMiddleware_1.authMiddleware, performanceController_1.getPerformanceSummary);
// Protected Notifications Summary
app.get("/v1/notifications/summary", authMiddleware_1.authMiddleware, notificationsController_1.getNotificationSummary);
// Apply error handler last
app.use(shared_config_1.errorHandlerMiddleware);
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    path: "/socket.io",
    addTrailingSlash: false,
    cors: {
        origin: "*", // Allow all origins for now
        methods: ["GET", "POST"],
    },
});
// We will create this file in the next step
const lessonHandler_1 = require("./websockets/lessonHandler");
(0, lessonHandler_1.setupLessonSocket)(io);
httpServer.listen(port, () => {
    console.log(`Learning Service running on port ${port}`);
});
