import express, { Request, Response } from "express";
import cors from "cors";
import {
  requestLoggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
} from "@tutor-advantage/shared-config";
import { authMiddleware } from "./middlewares/authMiddleware";
import { createClass, closeClass, getClasses, getClassById } from "./controllers/classController";
import { generateReferral } from "./controllers/referralController";
import { enrollStudent } from "./controllers/enrollmentController";
import { getDashboardSummary } from "./controllers/dashboardController";
import { getConversations, getMessages, sendMessage } from "./controllers/chatController";
import { getAuctionClasses, claimAuctionClass } from "./controllers/auctionController";
import { getPerformanceSummary } from "./controllers/performanceController";
import { getNotificationSummary } from "./controllers/notificationsController";

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
app.post("/v1/classes", authMiddleware, createClass);
app.post("/v1/classes/:classId/close", authMiddleware, closeClass);
app.get("/v1/classes", authMiddleware, getClasses);
app.get("/v1/classes/:classId", authMiddleware, getClassById);

// Protected Referral Routes
app.post("/v1/referrals/generate", authMiddleware, generateReferral);

// Protected Enrollment Route
app.post("/v1/enroll/:referralToken", authMiddleware, enrollStudent);

// Protected Dashboard API
app.get("/v1/dashboard/summary", authMiddleware, getDashboardSummary);

// Protected Chat Routes
app.get("/v1/chat/conversations", authMiddleware, getConversations);
app.get("/v1/chat/conversations/:conversationId/messages", authMiddleware, getMessages);
app.post("/v1/chat/conversations/:conversationId/messages", authMiddleware, sendMessage);

// Protected Auction Routes
app.get("/v1/classes/auction", authMiddleware, getAuctionClasses);
app.post("/v1/classes/auction/:transferId/claim", authMiddleware, claimAuctionClass);

// Protected Performance Route
app.get("/v1/tutors/performance", authMiddleware, getPerformanceSummary);

// Protected Notifications Summary
app.get("/v1/notifications/summary", authMiddleware, getNotificationSummary);

// Apply error handler last
app.use(errorHandlerMiddleware);

app.listen(port, () => {
  console.log(`Learning Service running on port ${port}`);
});
