"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferralDetails = getReferralDetails;
exports.enrollStudent = enrollStudent;
exports.directEnroll = directEnroll;
const database_1 = require("@tutor-advantage/database");
async function ensureEnrollmentPackageForClass(tx, enrollment) {
    const cls = await tx.class.findUnique({
        where: { classId: enrollment.classId },
        select: { classId: true, bookId: true, packagePriceMinor: true },
    });
    if (!cls)
        return null;
    let cycle = await tx.classBookCycle.findFirst({
        where: { classId: cls.classId, bookId: cls.bookId },
        orderBy: { sequence: "asc" },
    });
    if (!cycle) {
        cycle = await tx.classBookCycle.create({
            data: {
                classId: cls.classId,
                bookId: cls.bookId,
                sequence: 1,
                status: "OPEN",
                packagePriceMinor: cls.packagePriceMinor,
            },
        });
    }
    return tx.enrollmentPackage.upsert({
        where: {
            enrollmentId_classBookCycleId: {
                enrollmentId: enrollment.enrollmentId,
                classBookCycleId: cycle.classBookCycleId,
            },
        },
        create: {
            enrollmentId: enrollment.enrollmentId,
            classBookCycleId: cycle.classBookCycleId,
            studentUserId: enrollment.studentUserId,
            status: enrollment.status,
            paymentTransactionId: enrollment.paymentTransactionId,
        },
        update: {},
    });
}
async function getReferralDetails(req, res) {
    try {
        const { referralToken } = req.params;
        if (!referralToken) {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "referralToken is required",
                    requestId: req.id,
                },
            });
        }
        const referral = await database_1.prisma.referral.findUnique({
            where: { token: referralToken },
            include: {
                class: {
                    include: {
                        book: { include: { series: true } },
                    },
                },
            },
        });
        if (!referral || referral.status !== "ACTIVE") {
            return res.status(404).json({
                error: {
                    code: "REFERRAL_INVALID",
                    message: "The referral token is invalid or expired",
                    requestId: req.id,
                },
            });
        }
        const cls = referral.class;
        const tutor = await database_1.prisma.user.findUnique({
            where: { userId: cls.tutorUserId },
            select: { displayName: true, profilePictureUrl: true },
        });
        return res.status(200).json({
            class: {
                id: cls.classId,
                name: cls.title || cls.book?.title || "Untitled Class",
                book: cls.book?.title || "Unknown Book",
                status: cls.status.toLowerCase(),
                students: cls.enrolledCount || 0,
                maxStudents: cls.capacity,
                price: Number(cls.packagePriceMinor) / 100,
                packagePriceSatang: Number(cls.packagePriceMinor),
                cefr: cls.book?.series?.cefrLevel || "A1",
                schedule: cls.scheduleDescription || "ยังไม่ได้กำหนด",
                startsAt: cls.startsAt,
                endsAt: cls.endsAt,
                tutor: {
                    name: tutor?.displayName || "Unknown Tutor",
                    pictureUrl: tutor?.profilePictureUrl || null,
                },
            },
            referralToken: referral.token,
        });
    }
    catch (error) {
        console.error("Get Referral Details Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch referral details",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
async function enrollStudent(req, res) {
    try {
        const userId = req.user?.userId;
        const { referralToken } = req.params;
        if (!userId) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "User ID missing from token",
                    requestId: req.id,
                },
            });
        }
        if (!referralToken) {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "referralToken is required",
                    requestId: req.id,
                },
            });
        }
        // Wrap the entire enrollment + fallback logic in a transaction
        const enrollmentResult = await database_1.prisma.$transaction(async (tx) => {
            // 1. Find the referral
            const referral = await tx.referral.findUnique({
                where: { token: referralToken },
                include: {
                    class: true,
                },
            });
            if (!referral || referral.status !== "ACTIVE") {
                throw new Error("REFERRAL_INVALID");
            }
            // 2. Check primary class capacity
            const primaryClass = referral.class;
            let targetClassId = primaryClass.classId;
            if (primaryClass.status !== "OPEN" ||
                primaryClass.enrolledCount >= primaryClass.capacity) {
                // Fallback Logic: Primary class is full or closed. Look for another OPEN class by the same tutor.
                const availableClasses = await tx.class.findMany({
                    where: {
                        tutorUserId: primaryClass.tutorUserId,
                        status: "OPEN",
                    },
                });
                // Find the first class that still has capacity
                const fallbackClass = availableClasses.find((c) => c.enrolledCount < c.capacity);
                if (!fallbackClass) {
                    throw new Error("NO_FALLBACK_AVAILABLE");
                }
                targetClassId = fallbackClass.classId;
            }
            const existing = await tx.enrollment.findFirst({
                where: {
                    classId: targetClassId,
                    studentUserId: userId,
                    status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
                },
                orderBy: { createdAt: "desc" },
            });
            if (existing) {
                await ensureEnrollmentPackageForClass(tx, existing);
                return {
                    enrollmentId: existing.enrollmentId,
                    classId: existing.classId,
                    isFallback: targetClassId !== primaryClass.classId,
                };
            }
            // 3. Create the enrollment in PENDING_PAYMENT state
            const enrollment = await tx.enrollment.create({
                data: {
                    classId: targetClassId,
                    studentUserId: userId,
                    referralToken: referral.token,
                    status: "PENDING_PAYMENT",
                },
            });
            // 4. Increment the enrolled count for the target class
            await tx.class.update({
                where: { classId: targetClassId },
                data: {
                    enrolledCount: {
                        increment: 1,
                    },
                },
            });
            await ensureEnrollmentPackageForClass(tx, enrollment);
            return {
                enrollmentId: enrollment.enrollmentId,
                classId: enrollment.classId,
                isFallback: targetClassId !== primaryClass.classId,
            };
        });
        return res.status(200).json({
            message: "Enrollment successful. Pending payment.",
            enrollmentId: enrollmentResult.enrollmentId,
            classId: enrollmentResult.classId,
            placement: enrollmentResult.isFallback ? "FALLBACK" : "PRIMARY",
        });
    }
    catch (error) {
        if (error.message === "REFERRAL_INVALID") {
            return res.status(400).json({
                error: {
                    code: "REFERRAL_INVALID",
                    message: "The referral token is invalid or expired",
                    requestId: req.id,
                },
            });
        }
        if (error.message === "NO_FALLBACK_AVAILABLE") {
            return res.status(400).json({
                error: {
                    code: "CLASS_FULL",
                    message: "The target class is full and no alternative classes are available from this tutor",
                    requestId: req.id,
                },
            });
        }
        console.error("Enrollment Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not process enrollment",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
async function directEnroll(req, res) {
    try {
        const userId = req.user?.userId;
        const { classId } = req.body;
        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "User ID missing", requestId: req.id }
            });
        }
        if (!classId) {
            return res.status(400).json({
                error: { code: "BAD_REQUEST", message: "classId is required", requestId: req.id }
            });
        }
        const result = await database_1.prisma.$transaction(async (tx) => {
            // 1. Check if class exists and has capacity
            const targetClass = await tx.class.findUnique({
                where: { classId }
            });
            if (!targetClass)
                throw new Error("CLASS_NOT_FOUND");
            let targetClassId = targetClass.classId;
            let placedByFallback = false;
            if (targetClass.status !== "OPEN" ||
                targetClass.enrolledCount >= targetClass.capacity) {
                const fallbackClass = await tx.class.findFirst({
                    where: {
                        tutorUserId: targetClass.tutorUserId,
                        status: "OPEN",
                        enrolledCount: { lt: tx.class.fields.capacity },
                    },
                    orderBy: { createdAt: "asc" },
                });
                if (!fallbackClass) {
                    throw new Error(targetClass.status !== "OPEN" ? "CLASS_CLOSED" : "CLASS_FULL");
                }
                targetClassId = fallbackClass.classId;
                placedByFallback = true;
            }
            // 2. Check if already enrolled or has an open payment attempt.
            const existing = await tx.enrollment.findFirst({
                where: {
                    classId: targetClassId,
                    studentUserId: userId,
                    status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
                },
                orderBy: { createdAt: "desc" },
            });
            if (existing) {
                await ensureEnrollmentPackageForClass(tx, existing);
                return { ...existing, placedByFallback };
            }
            // 3. Create enrollment
            const enrollment = await tx.enrollment.create({
                data: {
                    classId: targetClassId,
                    studentUserId: userId,
                    status: "PENDING_PAYMENT"
                }
            });
            // 4. Update count
            await tx.class.update({
                where: { classId: targetClassId },
                data: { enrolledCount: { increment: 1 } }
            });
            await ensureEnrollmentPackageForClass(tx, enrollment);
            return { ...enrollment, placedByFallback };
        });
        return res.status(200).json({
            message: result.status === "ACTIVE"
                ? "Already enrolled and active."
                : "Direct enrollment successful. Pending payment.",
            enrollmentId: result.enrollmentId,
            classId: result.classId,
            status: result.status,
            placement: result.placedByFallback ? "FALLBACK" : "PRIMARY",
        });
    }
    catch (error) {
        console.error("Direct Enrollment Error:", error);
        const code = error.message.includes("CLASS") || error.message === "ALREADY_ENROLLED" ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
        return res.status(code === "BAD_REQUEST" ? 400 : 500).json({
            error: {
                code,
                message: error.message,
                requestId: req.id
            }
        });
    }
}
