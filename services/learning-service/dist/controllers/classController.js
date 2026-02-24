"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClass = createClass;
exports.closeClass = closeClass;
const database_1 = require("@tutor-advantage/database");
async function createClass(req, res) {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        const { bookId, title, capacity } = req.body;
        if (!userId || role !== "TUTOR") {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED_ROLE",
                    message: "Only tutors can create classes",
                    requestId: req.id,
                },
            });
        }
        if (!bookId || !title || typeof capacity !== "number") {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "bookId, title, and capacity are required",
                    requestId: req.id,
                },
            });
        }
        const newClass = await database_1.prisma.class.create({
            data: {
                tutorUserId: userId,
                bookId,
                title,
                capacity,
                status: "OPEN",
            },
        });
        return res.status(201).json({
            message: "Class created successfully",
            class: newClass,
        });
    }
    catch (error) {
        console.error("Create Class Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not create class",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
async function closeClass(req, res) {
    try {
        const userId = req.user?.userId;
        const { classId } = req.params;
        if (!userId) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "User ID missing from token",
                    requestId: req.id,
                },
            });
        }
        const existingClass = await database_1.prisma.class.findUnique({
            where: { classId },
        });
        if (!existingClass) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Class not found",
                    requestId: req.id,
                },
            });
        }
        if (existingClass.tutorUserId !== userId) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You can only close your own classes",
                    requestId: req.id,
                },
            });
        }
        const updatedClass = await database_1.prisma.class.update({
            where: { classId },
            data: { status: "CLOSED" },
        });
        return res.status(200).json({
            message: "Class closed successfully",
            class: updatedClass,
        });
    }
    catch (error) {
        console.error("Close Class Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not close class",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
