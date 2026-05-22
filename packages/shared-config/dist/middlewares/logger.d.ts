import winston from "winston";
import { Request, Response, NextFunction } from "express";
declare const logger: winston.Logger;
export declare const requestLoggerMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export { logger };
