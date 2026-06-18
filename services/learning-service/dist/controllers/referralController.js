"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReferral = generateReferral;
const shared_config_1 = require("@tutor-advantage/shared-config");
const database_1 = require("@tutor-advantage/database");
const uuid_1 = require("uuid");
const STUDENT_APP_PROD_URL = "https://student-liff-1090865515742.asia-southeast1.run.app";
const STUDENT_APP_DEV_URL = "https://resource-pushpin-tabby.ngrok-free.dev";
function getStudentAppBaseUrl() {
    return process.env.FRONTEND_APP_URL ||
        (process.env.NODE_ENV === "production" ? STUDENT_APP_PROD_URL : STUDENT_APP_DEV_URL);
}
async function generateReferral(req, res) {
    try {
        const userId = req.user?.userId;
        const { classId } = req.body;
        if (!userId) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "User ID missing from token",
                    requestId: req.id,
                },
            });
        }
        if (!classId) {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "classId is required",
                    requestId: req.id,
                },
            });
        }
        const targetClass = await database_1.prisma.class.findUnique({
            where: { classId },
        });
        if (!targetClass) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Class not found",
                    requestId: req.id,
                },
            });
        }
        if (targetClass.tutorUserId !== userId) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You can only generate referrals for your own classes",
                    requestId: req.id,
                },
            });
        }
        if (targetClass.status !== "OPEN") {
            return res.status(400).json({
                error: {
                    code: "CLASS_CLOSED",
                    message: "Cannot generate referral for a closed class",
                    requestId: req.id,
                },
            });
        }
        // Generate unique token
        const token = (0, uuid_1.v4)();
        // In a real scenario, this domain would be configurable via env vars
        // For now, aligning with the PWA/LIFF architecture plan
        const baseUrl = getStudentAppBaseUrl();
        const params = new URLSearchParams({ classId, referralToken: token });
        const referralUrl = `${baseUrl}/enroll?${params.toString()}`;
        const newReferral = await database_1.prisma.referral.create({
            data: {
                token: token,
                classId: classId,
                tutorUserId: userId,
                status: "ACTIVE",
            },
        });
        return res.status(200).json({
            message: "Referral generated successfully",
            referralToken: newReferral.token,
            url: referralUrl,
            qrPayload: referralUrl, // For QR generation on the frontend
        });
    }
    catch (error_err) {
        const error = error_err;
        shared_config_1.logger.error("Generate Referral Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not generate referral",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
