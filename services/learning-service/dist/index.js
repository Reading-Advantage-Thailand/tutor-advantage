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
shared_config_1.logger.info(`[Learning] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);
const { prisma } = require("@tutor-advantage/database");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const shared_config_1 = require("@tutor-advantage/shared-config");
const authMiddleware_1 = require("./middlewares/authMiddleware");
const classController_1 = require("./controllers/classController");
const demoController_1 = require("./controllers/demoController");
const referralController_1 = require("./controllers/referralController");
const enrollmentController_1 = require("./controllers/enrollmentController");
const dashboardController_1 = require("./controllers/dashboardController");
const chatController_1 = require("./controllers/chatController");
const auctionController_1 = require("./controllers/auctionController");
const performanceController_1 = require("./controllers/performanceController");
const reviewController_1 = require("./controllers/reviewController");
const notificationsController_1 = require("./controllers/notificationsController");
const couponController_1 = require("./controllers/couponController");
const lessonHistoryController_1 = require("./controllers/lessonHistoryController");
const devController_1 = require("./controllers/devController");
const app = (0, express_1.default)();
const port = process.env.PORT || 3002;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://student-liff-1090865515742.asia-southeast1.run.app,https://resource-pushpin-tabby.ngrok-free.dev,http://localhost:3000,http://localhost:3004,http://localhost:3005,http://localhost:3006").split(",").map((o) => o.trim());
const ALLOWED_ORIGIN_PATTERNS = [
    /^https?:\/\/.*\.ngrok-free\.app$/,
    /^https?:\/\/.*\.ngrok-free\.dev$/,
    /^https?:\/\/.*\.ngrok\.io$/,
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow server-to-server calls (no origin) and whitelisted origins
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
// Base endpoints — health check verifies DB connectivity
app.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        res.status(200).json({ status: "ok", service: "learning-service" });
    }
    catch {
        res.status(503).json({ status: "error", service: "learning-service", reason: "db_unreachable" });
    }
});
app.get("/version", (_req, res) => {
    res.status(200).json({ version: "1.0.0", service: "learning-service" });
});
// Protected Class Routes
app.get("/v1/books", authMiddleware_1.authMiddleware, classController_1.getBooks);
app.get("/v1/demo/lessons", authMiddleware_1.authMiddleware, demoController_1.getDemoLessonCatalog);
app.post("/v1/classes", authMiddleware_1.authMiddleware, classController_1.createClass);
app.post("/v1/classes/:classId/close", authMiddleware_1.authMiddleware, classController_1.closeClass);
app.get("/v1/classes", authMiddleware_1.authMiddleware, classController_1.getClasses);
app.get("/v1/classes/available", authMiddleware_1.authMiddleware, classController_1.getAvailableClasses);
app.get("/v1/classes/:classId", authMiddleware_1.authMiddleware, classController_1.getClassById);
app.delete("/v1/classes/:classId", authMiddleware_1.authMiddleware, classController_1.deleteClass);
app.patch("/v1/classes/:classId/meeting-url", authMiddleware_1.authMiddleware, classController_1.updateMeetingUrl);
app.patch("/v1/classes/:classId/schedule", authMiddleware_1.authMiddleware, classController_1.rescheduleClass);
app.get("/v1/classes/:classId/articles", authMiddleware_1.authMiddleware, classController_1.getClassArticles);
app.post("/v1/classes/:classId/book-cycles", authMiddleware_1.authMiddleware, classController_1.createClassBookCycle);
app.post("/v1/classes/:classId/book-cycles/:cycleId/access", authMiddleware_1.authMiddleware, classController_1.prepareClassBookCycleAccess);
// Protected Referral Routes
app.post("/v1/referrals/generate", authMiddleware_1.authMiddleware, referralController_1.generateReferral);
// Protected Enrollment Route
app.post("/v1/enroll/direct", authMiddleware_1.authMiddleware, enrollmentController_1.directEnroll);
app.get("/v1/enroll/:referralToken/details", authMiddleware_1.authMiddleware, enrollmentController_1.getReferralDetails);
app.post("/v1/enroll/:referralToken", authMiddleware_1.authMiddleware, enrollmentController_1.enrollStudent);
// Protected Dashboard API
app.get("/v1/dashboard/summary", authMiddleware_1.authMiddleware, dashboardController_1.getDashboardSummary);
app.get("/v1/student/progress", authMiddleware_1.authMiddleware, dashboardController_1.getStudentProgress);
app.get("/v1/student/articles/:articleId", authMiddleware_1.authMiddleware, dashboardController_1.getStudentArticle);
app.post("/v1/student/share-link", authMiddleware_1.authMiddleware, dashboardController_1.generateStudentShareLink);
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
// Protected Review Routes
app.get("/v1/classes/:classId/review", authMiddleware_1.authMiddleware, reviewController_1.getMyTutorReviewForClass);
app.post("/v1/classes/:classId/review", authMiddleware_1.authMiddleware, reviewController_1.submitTutorReview);
// Protected Notifications Summary
app.get("/v1/notifications/summary", authMiddleware_1.authMiddleware, notificationsController_1.getNotificationSummary);
// Protected Coupon Routes (tutor)
app.get("/v1/coupons/mine", authMiddleware_1.authMiddleware, couponController_1.getMyCoupons);
app.post("/v1/coupons/validate", authMiddleware_1.authMiddleware, couponController_1.validateCouponCode);
app.post("/v1/classes/:classId/apply-coupon", authMiddleware_1.authMiddleware, couponController_1.applyCouponToClass);
// Dev-only routes (blocked in production by devOnly middleware)
app.post("/v1/dev/seed/lesson-history", devController_1.devOnly, authMiddleware_1.authMiddleware, devController_1.devSeedLessonHistory);
app.delete("/v1/dev/seed/lesson-history", devController_1.devOnly, authMiddleware_1.authMiddleware, devController_1.devPurgeLessonHistory);
app.post("/v1/dev/seed/full-progress", devController_1.devOnly, authMiddleware_1.authMiddleware, devController_1.devSeedFullProgress);
app.post("/v1/dev/seed/enrollments/activate", devController_1.devOnly, authMiddleware_1.authMiddleware, devController_1.devActivateEnrollments);
app.post("/v1/dev/seed/class-all-progress", devController_1.devOnly, authMiddleware_1.authMiddleware, devController_1.devSeedClassAllProgress);
// Apply error handler last
app.use(shared_config_1.errorHandlerMiddleware);
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    path: "/socket.io",
    addTrailingSlash: false,
    cors: {
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (ALLOWED_ORIGINS.includes(origin))
                return callback(null, true);
            if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin)))
                return callback(null, true);
            callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        methods: ["GET", "POST"],
        credentials: true,
    },
});
// We will create this file in the next step
const lessonHandler_1 = require("./websockets/lessonHandler");
(0, lessonHandler_1.setupLessonSocket)(io);
httpServer.listen(port, () => {
    shared_config_1.logger.info(`Learning Service running on port ${port}`);
});
// Graceful shutdown — drain HTTP + WebSocket connections then disconnect DB
const shutdown = (signal) => async () => {
    shared_config_1.logger.info(`[Learning] ${signal} received — shutting down gracefully`);
    io.close(() => {
        httpServer.close(async () => {
            await prisma.$disconnect();
            shared_config_1.logger.info("[Learning] Shutdown complete");
            process.exit(0);
        });
    });
    setTimeout(() => {
        shared_config_1.logger.error("[Learning] Shutdown timeout — forcing exit");
        process.exit(1);
    }, 10_000).unref();
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
