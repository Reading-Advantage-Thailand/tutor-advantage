import express, { Request, Response } from "express";
import cors from "cors";
import {
  requestLoggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
} from "@tutor-advantage/shared-config";
import { authMiddleware } from "./middlewares/authMiddleware";
import {
  createPaymentIntent,
  handleWebhook,
} from "./controllers/paymentController";
import {
  previewSettlement,
  approveSettlement,
} from "./controllers/settlementController";
import { auditTrailMiddleware } from "./middlewares/auditMiddleware";

const app = express();
const port = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Apply shared middleware
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Base endpoints
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "finance-mlm-service" });
});

app.get("/version", (req: Request, res: Response) => {
  res.status(200).json({ version: "1.0.0", service: "finance-mlm-service" });
});

// Protected Payment Routes
app.post("/v1/payments/intent", authMiddleware, createPaymentIntent);

// Public Webhook Routes
app.post("/v1/payments/webhook", handleWebhook);

// Admin Finance Console Routes
app.post(
  "/v1/settlements/preview",
  authMiddleware,
  auditTrailMiddleware("PREVIEW_SETTLEMENT"),
  previewSettlement,
);
app.post(
  "/v1/settlements/:snapshotId/approve",
  authMiddleware,
  auditTrailMiddleware("APPROVE_SETTLEMENT"),
  approveSettlement,
);

// Apply error handler last
app.use(errorHandlerMiddleware);

app.listen(port, () => {
  console.log(`Finance & MLM Service running on port ${port}`);
});
