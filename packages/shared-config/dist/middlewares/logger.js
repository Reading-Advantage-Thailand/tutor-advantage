"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.requestLoggerMiddleware = void 0;
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [new winston_1.default.transports.Console()],
});
exports.logger = logger;
const requestLoggerMiddleware = (req, res, next) => {
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
exports.requestLoggerMiddleware = requestLoggerMiddleware;
