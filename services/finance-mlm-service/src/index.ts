import express, { Request, Response } from "express";
import cors from "cors";
import {
  requestLoggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
  logger,
} from "@tutor-advantage/shared-config";

const app = express();
app.use(cors());
app.use(express.json());

// Shared Middlewares
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Health Check Endpoint
app.get("/health", (req: Request, res: Response) => {
  res
    .status(200)
    .json({
      status: "ok",
      service: "finance-mlm-service",
      timestamp: new Date().toISOString(),
    });
});

// Version Endpoint
app.get("/version", (req: Request, res: Response) => {
  res.status(200).json({ version: "1.0.0", service: "finance-mlm-service" });
});

// Root API
app.get("/", (req: Request, res: Response) => {
  res.send("Finance MLM Service API");
});

// Error handling middleware (Must be last)
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 3003;
app.listen(port, () => {
  logger.info(`Finance MLM Service running on port ${port}`);
});
