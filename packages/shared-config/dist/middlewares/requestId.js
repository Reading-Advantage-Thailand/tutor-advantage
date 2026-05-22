"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = void 0;
const uuid_1 = require("uuid");
const requestIdMiddleware = (req, res, next) => {
    const requestId = req.headers["x-request-id"] || (0, uuid_1.v4)();
    req.id = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
