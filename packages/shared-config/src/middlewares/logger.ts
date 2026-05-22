import winston from "winston";
import { Request, Response, NextFunction } from "express";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;
    logger.info("HTTP Access", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: ms,
      requestId: req.id,
      ip: req.ip,
    });
  });

  next();
};

export { logger };
