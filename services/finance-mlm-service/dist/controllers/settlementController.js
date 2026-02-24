"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewSettlement = previewSettlement;
exports.approveSettlement = approveSettlement;
const settlementService_1 = require("../services/settlementService");
async function previewSettlement(req, res) {
    try {
        const userId = req.user?.userId;
        const { periodMonth } = req.body; // e.g., '2026-02'
        // Mocking an ADMIN role check
        if (!userId || req.user?.role !== "ADMIN") {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED_ROLE",
                    message: "Only admins can preview settlements",
                    requestId: req.id,
                },
            });
        }
        if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "Valid periodMonth (YYYY-MM) is required",
                    requestId: req.id,
                },
            });
        }
        const preview = await settlementService_1.SettlementService.previewSettlement(periodMonth, userId);
        return res.status(200).json({
            message: "Settlement preview generated",
            preview,
        });
    }
    catch (error) {
        console.error("Preview Settlement Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not generate settlement preview",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
async function approveSettlement(req, res) {
    try {
        const userId = req.user?.userId;
        const { snapshotId } = req.params;
        // Simulate Checker Role - Maker-Checker workflow
        if (!userId ||
            (req.user?.role !== "FINANCE_CHECKER" && req.user?.role !== "ADMIN")) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Only authorized checkers can approve settlements",
                    requestId: req.id,
                },
            });
        }
        if (!snapshotId) {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "snapshotId is required in the path",
                    requestId: req.id,
                },
            });
        }
        const approvedRun = await settlementService_1.SettlementService.approveSettlement(snapshotId, userId);
        return res.status(200).json({
            message: "Settlement run approved",
            run: approvedRun,
        });
    }
    catch (error) {
        if (error.message === "NOT_FOUND") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Settlement run not found",
                    requestId: req.id,
                },
            });
        }
        if (error.message === "INVALID_STATUS") {
            return res.status(400).json({
                error: {
                    code: "INVALID_STATUS",
                    message: "Settlement run must be in DRAFT to approve",
                    requestId: req.id,
                },
            });
        }
        console.error("Approve Settlement Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not approve settlement run",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
