"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlerMiddleware = exports.AppError = void 0;
const logger_1 = require("./logger");
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(options) {
        super(options.message);
        this.statusCode = options.statusCode;
        this.code = options.code || "INTERNAL_ERROR";
        this.details = options.details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandlerMiddleware = (err, req, res, next) => {
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
    // Log the error
    const errorLogPayload = {
        message: err.message,
        code,
        requestId: req.id,
        stack: statusCode >= 500 ? err.stack : undefined, // Only log stack for 5xx errors
    };
    if (statusCode >= 500) {
        logger_1.logger.error("Unhandled Server Error", errorLogPayload);
    }
    else {
        logger_1.logger.warn("Client Error", errorLogPayload);
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
exports.errorHandlerMiddleware = errorHandlerMiddleware;
