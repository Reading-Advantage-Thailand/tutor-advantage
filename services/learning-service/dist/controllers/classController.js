"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClass = createClass;
exports.closeClass = closeClass;
exports.getClasses = getClasses;
exports.getClassById = getClassById;
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
async function getClasses(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "User ID missing" },
            });
        }
        const classes = await database_1.prisma.class.findMany({
            where: { tutorUserId: userId },
            include: { book: true, _count: { select: { enrollments: true } } },
            orderBy: { createdAt: "desc" },
        });
        const mappedClasses = classes.map((c) => ({
            id: c.classId,
            name: c.title,
            book: c.book?.title || "Unknown Book",
            status: c.status.toLowerCase(),
            students: c._count.enrollments,
            maxStudents: c.capacity,
            nextSession: "จ. 10 มี.ค. 19:00", // Hardcoded mock for UI presentation
        }));
        return res.status(200).json({ classes: mappedClasses });
    }
    catch (error) {
        console.error("Get Classes Error:", error);
        return res.status(500).json({
            error: { code: "INTERNAL_SERVER_ERROR", message: "Could not fetch classes" },
        });
    }
}
async function getClassById(req, res) {
    try {
        const userId = req.user?.userId;
        const { classId } = req.params;
        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "User ID missing" },
            });
        }
        const cls = await database_1.prisma.class.findUnique({
            where: { classId },
            include: { book: true, enrollments: true },
        });
        if (!cls || cls.tutorUserId !== userId) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "Class not found" },
            });
        }
        // Fetch user details for the students
        const studentIds = cls.enrollments.map((e) => e.studentUserId);
        const users = await database_1.prisma.user.findMany({
            where: { userId: { in: studentIds } },
            select: { userId: true, displayName: true },
        });
        const userMap = new Map();
        users.forEach((u) => userMap.set(u.userId, u.displayName));
        const mapped = {
            id: cls.classId,
            name: cls.title,
            book: cls.book?.title || "Unknown Book",
            status: cls.status.toLowerCase(),
            students: cls.enrollments.length,
            maxStudents: cls.capacity,
            schedule: "ทุกวันจันทร์ 19:00–21:00", // Mock
            meetingUrl: "https://meet.google.com/abc-defg-hij", // Mock
            referralLink: `https://liff.line.me/9999999-XXXXXXXX?classId=${cls.classId}`,
            enrolledStudents: cls.enrollments.map((e) => ({
                name: userMap.get(e.studentUserId) || "Unknown Student",
                enrolled: e.createdAt.toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                }),
                paid: e.status === "ACTIVE",
            })),
        };
        return res.status(200).json({ class: mapped });
    }
    catch (error) {
        console.error("Get Class By ID Error:", error);
        return res.status(500).json({
            error: { code: "INTERNAL_SERVER_ERROR", message: "Could not fetch class" },
        });
    }
}
