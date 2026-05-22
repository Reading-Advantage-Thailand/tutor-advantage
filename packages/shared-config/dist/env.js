"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireEnv = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from .env if present
dotenv_1.default.config();
const requireEnv = (name) => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};
exports.requireEnv = requireEnv;
