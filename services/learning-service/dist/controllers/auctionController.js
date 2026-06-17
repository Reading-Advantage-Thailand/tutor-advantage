"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimAuctionClass = exports.getAuctionClasses = void 0;
const shared_config_1 = require("@tutor-advantage/shared-config");
const database_1 = require("@tutor-advantage/database");
// Get open class transfer requests (auction)
const getAuctionClasses = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const openRequests = await database_1.prisma.classTransferRequest.findMany({
            where: {
                status: "OPEN",
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ],
                // Don't show tutor's own classes in auction
                originalTutorId: { not: userId }
            },
            include: {
                class: {
                    include: {
                        book: {
                            select: {
                                title: true,
                                classHours: true,
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" },
        });
        const formattedAuctions = openRequests.map((req) => ({
            id: req.transferId,
            classId: req.classId,
            title: req.class.title,
            subject: req.class.book.title,
            students: req.class.enrolledCount,
            networkBonusRate: req.networkBonusRate.toNumber(),
            reason: req.reason || "ไม่ระบุเหตุผล",
            expiresAt: req.expiresAt,
        }));
        res.status(200).json({ auctions: formattedAuctions });
    }
    catch (error) {
        shared_config_1.logger.error("Failed to fetch auction classes", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getAuctionClasses = getAuctionClasses;
// Claim an opened class transfer
const claimAuctionClass = async (req, res) => {
    try {
        const { transferId } = req.params;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        // Use transaction to ensure thread-safety when claiming
        const result = await database_1.prisma.$transaction(async (tx) => {
            const transferRequest = await tx.classTransferRequest.findUnique({
                where: { transferId },
                include: { class: true }
            });
            if (!transferRequest) {
                throw new Error("Transfer request not found");
            }
            if (transferRequest.status !== "OPEN") {
                throw new Error("Class is no longer available");
            }
            if (transferRequest.expiresAt && transferRequest.expiresAt < new Date()) {
                throw new Error("Transfer request has expired");
            }
            if (transferRequest.originalTutorId === userId) {
                throw new Error("Cannot claim your own class");
            }
            // Update the transfer request
            const updatedTransfer = await tx.classTransferRequest.update({
                where: { transferId },
                data: {
                    status: "TRANSFERRED",
                    newTutorId: userId,
                    updatedAt: new Date(),
                }
            });
            // Transfer the class to the new tutor
            await tx.class.update({
                where: { classId: transferRequest.classId },
                data: {
                    tutorUserId: userId,
                    updatedAt: new Date(),
                }
            });
            // Record in audit log (using untyped query as it's in a different schema, but typically we'd structure this better)
            try {
                await tx.$executeRaw `
           INSERT INTO "finance_mlm"."audit_events" 
           ("audit_event_id", "actor_id", "action", "entity_type", "entity_id", "payload", "created_at") 
           VALUES (gen_random_uuid(), ${userId}, 'CLAIM_CLASS_TRANSFER', 'CLASS', ${transferRequest.classId}, ${JSON.stringify({
                    transferId,
                    originalTutorId: transferRequest.originalTutorId,
                    bonusRate: transferRequest.networkBonusRate
                })}::jsonb, NOW())`;
            }
            catch (e) {
                // Silently fail audit log if it doesn't work across schemas in this transaction setup
                shared_config_1.logger.error("Audit log failed", e);
            }
            return updatedTransfer;
        });
        res.status(200).json({
            success: true,
            message: "Class claimed successfully",
            transfer: {
                id: result.transferId,
                classId: result.classId,
            }
        });
    }
    catch (error_err) {
        const error = error_err;
        shared_config_1.logger.error("Failed to claim auction class", error, req.params.transferId);
        // Provide user-friendly errors for known conditions
        if (error.message === "Class is no longer available" ||
            error.message === "Transfer request has expired" ||
            error.message === "Cannot claim your own class") {
            res.status(400).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.claimAuctionClass = claimAuctionClass;
