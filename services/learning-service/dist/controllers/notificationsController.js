"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationSummary = void 0;
const shared_config_1 = require("@tutor-advantage/shared-config");
const database_1 = require("@tutor-advantage/database");
const prisma = new database_1.PrismaClient();
const getNotificationSummary = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        // 1. Get unread messages count
        const participants = await prisma.conversationParticipant.findMany({
            where: { userId }
        });
        let unreadChatCount = 0;
        // Calculate unread messages in parallel
        await Promise.all(participants.map(async (p) => {
            const count = await prisma.message.count({
                where: {
                    conversationId: p.conversationId,
                    senderId: { not: userId }, // Don't count our own messages
                    ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {})
                }
            });
            unreadChatCount += count;
        }));
        // 2. Get available auctions count
        const availableAuctionsCount = await prisma.classTransferRequest.count({
            where: {
                status: "OPEN",
                // Not requested by the current user
                originalTutorId: {
                    not: userId
                }
            }
        });
        res.status(200).json({
            notifications: {
                unreadChat: unreadChatCount,
                availableAuctions: availableAuctionsCount
            }
        });
    }
    catch (error) {
        shared_config_1.logger.error("Error fetching notification summary:", error);
        res.status(500).json({ error: "Failed to fetch notification summary" });
    }
};
exports.getNotificationSummary = getNotificationSummary;
