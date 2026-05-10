import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

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
} from "./controllers/classController";
import { generateReferral } from "./controllers/referralController";
import {
  enrollStudent,
  directEnroll,
} from "./controllers/enrollmentController";
import { getDashboardSummary } from "./controllers/dashboardController";
import {
  getConversations,
  getMessages,
  sendMessage,
} from "./controllers/chatController";
import {
  getAuctionClasses,
  claimAuctionClass,
} from "./controllers/auctionController";
import { getPerformanceSummary } from "./controllers/performanceController";
import { getNotificationSummary } from "./controllers/notificationsController";
import { getStudentLessonHistory, getLessonSessionDetails } from "./controllers/lessonHistoryController";

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Apply shared middleware
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Base endpoints
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "learning-service" });
});

app.get("/version", (req: Request, res: Response) => {
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

// Protected Referral Routes
app.post("/v1/referrals/generate", authMiddleware, generateReferral);

// Protected Enrollment Route
app.post("/v1/enroll/direct", authMiddleware, directEnroll);
app.post("/v1/enroll/:referralToken", authMiddleware, enrollStudent);

// Protected Dashboard API
app.get("/v1/dashboard/summary", authMiddleware, getDashboardSummary);

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

// Protected Auction Routes
app.get("/v1/classes/auction", authMiddleware, getAuctionClasses);
app.post(
  "/v1/classes/auction/:transferId/claim",
  authMiddleware,
  claimAuctionClass,
);

// Protected Performance Route
app.get("/v1/tutors/performance", authMiddleware, getPerformanceSummary);

// Protected Notifications Summary
app.get("/v1/notifications/summary", authMiddleware, getNotificationSummary);

// Apply error handler last
app.use(errorHandlerMiddleware);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for now
    methods: ["GET", "POST"],
  },
});

// We will create this file in the next step
import { setupLessonSocket } from "./websockets/lessonHandler";
setupLessonSocket(io);

httpServer.listen(port, () => {
  console.log(`Learning Service running on port ${port}`);
});
