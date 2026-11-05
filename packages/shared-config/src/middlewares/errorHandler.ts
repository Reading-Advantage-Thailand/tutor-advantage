import { Request, Response, NextFunction } from "express";
import { getSafeRequestPath, logger } from "./logger";

export interface AppErrorOptions {
  message: string;
  statusCode: number;
  code?: string;
  details?: any;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: any;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.statusCode = options.statusCode;
    this.code = options.code || "INTERNAL_ERROR";
    this.details = options.details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred";
  let details = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }

  // 5xx / unexpected errors go out at error level with the Error itself, so
  // the log carries stack_trace for Error Reporting and pages Discord.
  // 4xx AppErrors are client mistakes: warn, no stack, no alert.
  const errorLogPayload = {
    message: err.message,
    code,
    statusCode,
    requestId: req.id,
    path: getSafeRequestPath(req),
  };

  if (statusCode >= 500) {
    logger.error("Unhandled Server Error", { ...errorLogPayload, error: err });
  } else {
    logger.warn("Client Error", errorLogPayload);
  }

  // Send standard envelope
  res.status(statusCode).json({
    error: {
      code,
      message,
      requestId: req.id,
      ...(details ? { details } : {}),
    },
  });
};
