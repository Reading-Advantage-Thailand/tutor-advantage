import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load the monorepo .env file from both ts-node src/ and compiled dist/ starts.
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
  override: true,
});
console.log(`[Learning] Loaded DATABASE_URL starting with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);

const { prisma } = require("@tutor-advantage/database") as typeof import("@tutor-advantage/database");

import { createServer } from "http";
import { Server } from "socket.io";
import {
  requestLoggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
} from "@tutor-advantage/shared-config";
import { authMiddleware } from "./middlewares/authMiddleware";
import {
  createClass,
  closeClass,
  getClasses,
  getClassById,
  getBooks,
  deleteClass,
  updateMeetingUrl,
  getAvailableClasses,
  getClassArticles,
  createClassBookCycle,
  prepareClassBookCycleAccess,
} from "./controllers/classController";
import { generateReferral } from "./controllers/referralController";
import {
  enrollStudent,
  directEnroll,
  getReferralDetails,
} from "./controllers/enrollmentController";
import { getDashboardSummary, getStudentProgress, getStudentArticle, generateStudentShareLink } from "./controllers/dashboardController";
import {
  getConversations,
  getMessages,
  sendMessage,
  initiateChat,
} from "./controllers/chatController";
import {
  getAuctionClasses,
  claimAuctionClass,
} from "./controllers/auctionController";
import { getPerformanceSummary } from "./controllers/performanceController";
import { getMyTutorReviewForClass, submitTutorReview } from "./controllers/reviewController";
import { getNotificationSummary } from "./controllers/notificationsController";
import { getStudentLessonHistory, getLessonSessionDetails } from "./controllers/lessonHistoryController";
import {
  devOnly,
  devSeedLessonHistory,
  devPurgeLessonHistory,
  devActivateEnrollments,
  devSeedFullProgress,
  devSeedClassAllProgress,
} from "./controllers/devController";

const app = express();
const port = process.env.PORT || 3002;

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "https://student-liff-1090865515742.asia-southeast1.run.app,https://resource-pushpin-tabby.ngrok-free.dev,http://localhost:3000,http://localhost:3004,http://localhost:3005,http://localhost:3006"
).split(",").map((o) => o.trim());

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/.*\.ngrok-free\.app$/,
  /^https?:\/\/.*\.ngrok-free\.dev$/,
  /^https?:\/\/.*\.ngrok\.io$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server calls (no origin) and whitelisted origins
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

// Base endpoints — health check verifies DB connectivity
app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", service: "learning-service" });
  } catch {
    res.status(503).json({ status: "error", service: "learning-service", reason: "db_unreachable" });
  }
});

app.get("/version", (_req: Request, res: Response) => {
  res.status(200).json({ version: "1.0.0", service: "learning-service" });
});

// Protected Class Routes
app.get("/v1/books", authMiddleware, getBooks);
app.post("/v1/classes", authMiddleware, createClass);
app.post("/v1/classes/:classId/close", authMiddleware, closeClass);
app.get("/v1/classes", authMiddleware, getClasses);
app.get("/v1/classes/available", authMiddleware, getAvailableClasses);
app.get("/v1/classes/:classId", authMiddleware, getClassById);
app.delete("/v1/classes/:classId", authMiddleware, deleteClass);
app.patch("/v1/classes/:classId/meeting-url", authMiddleware, updateMeetingUrl);
app.get("/v1/classes/:classId/articles", authMiddleware, getClassArticles);
app.post("/v1/classes/:classId/book-cycles", authMiddleware, createClassBookCycle);
app.post("/v1/classes/:classId/book-cycles/:cycleId/access", authMiddleware, prepareClassBookCycleAccess);

// Protected Referral Routes
app.post("/v1/referrals/generate", authMiddleware, generateReferral);

// Protected Enrollment Route
app.post("/v1/enroll/direct", authMiddleware, directEnroll);
app.get("/v1/enroll/:referralToken/details", authMiddleware, getReferralDetails);
app.post("/v1/enroll/:referralToken", authMiddleware, enrollStudent);

// Protected Dashboard API
app.get("/v1/dashboard/summary", authMiddleware, getDashboardSummary);
app.get("/v1/student/progress", authMiddleware, getStudentProgress);
app.get("/v1/student/articles/:articleId", authMiddleware, getStudentArticle);
app.post("/v1/student/share-link", authMiddleware, generateStudentShareLink);

// Protected Lesson History Routes
app.get("/v1/lessons/history", authMiddleware, getStudentLessonHistory);
app.get("/v1/lessons/history/:sessionId", authMiddleware, getLessonSessionDetails);

// Protected Chat Routes
app.get("/v1/chat/conversations", authMiddleware, getConversations);
app.get(
  "/v1/chat/conversations/:conversationId/messages",
  authMiddleware,
  getMessages,
);
app.post(
  "/v1/chat/conversations/:conversationId/messages",
  authMiddleware,
  sendMessage,
);
app.post(
  "/v1/chat/initiate",
  authMiddleware,
  initiateChat,
);

// Protected Auction Routes
app.get("/v1/classes/auction", authMiddleware, getAuctionClasses);
app.post(
  "/v1/classes/auction/:transferId/claim",
  authMiddleware,
  claimAuctionClass,
);

// Protected Performance Route
app.get("/v1/tutors/performance", authMiddleware, getPerformanceSummary);

// Protected Review Routes
app.get("/v1/classes/:classId/review", authMiddleware, getMyTutorReviewForClass);
app.post("/v1/classes/:classId/review", authMiddleware, submitTutorReview);

// Protected Notifications Summary
app.get("/v1/notifications/summary", authMiddleware, getNotificationSummary);

// Dev-only routes (blocked in production by devOnly middleware)
app.post("/v1/dev/seed/lesson-history", devOnly, authMiddleware, devSeedLessonHistory);
app.delete("/v1/dev/seed/lesson-history", devOnly, authMiddleware, devPurgeLessonHistory);
app.post("/v1/dev/seed/full-progress", devOnly, authMiddleware, devSeedFullProgress);
app.post("/v1/dev/seed/enrollments/activate", devOnly, authMiddleware, devActivateEnrollments);
app.post("/v1/dev/seed/class-all-progress", devOnly, authMiddleware, devSeedClassAllProgress);

// Apply error handler last
app.use(errorHandlerMiddleware);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: "/socket.io",
  addTrailingSlash: false,
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin))) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// We will create this file in the next step
import { setupLessonSocket } from "./websockets/lessonHandler";
setupLessonSocket(io);

httpServer.listen(port, () => {
  console.log(`Learning Service running on port ${port}`);
});

// Graceful shutdown — drain HTTP + WebSocket connections then disconnect DB
const shutdown = (signal: string) => async () => {
  console.log(`[Learning] ${signal} received — shutting down gracefully`);
  io.close(() => {
    httpServer.close(async () => {
      await prisma.$disconnect();
      console.log("[Learning] Shutdown complete");
      process.exit(0);
    });
  });
  setTimeout(() => {
    console.error("[Learning] Shutdown timeout — forcing exit");
    process.exit(1);
  }, 10_000).unref();
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
