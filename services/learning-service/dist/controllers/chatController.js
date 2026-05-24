"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateChat = exports.sendMessage = exports.getMessages = exports.getConversations = void 0;
const database_1 = require("@tutor-advantage/database");
const LineNotificationService_1 = require("../services/LineNotificationService");
// Get list of conversations for the current user
const getConversations = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const conversations = await database_1.prisma.conversation.findMany({
            where: {
                participants: {
                    some: { userId },
                },
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                userId: true,
                                displayName: true,
                                profilePictureUrl: true,
                            },
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        sender: {
                            select: {
                                displayName: true,
                            },
                        },
                    },
                },
                class: {
                    select: {
                        title: true,
                        status: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        const formattedConversations = await Promise.all(conversations.map(async (conv) => {
            // Find the other participant in a direct message or all others in group
            const others = conv.participants.filter((p) => p.userId !== userId);
            const me = conv.participants.find((p) => p.userId === userId);
            // Determine display name and image for the conversation
            let title = conv.type === "GROUP" ? "กลุ่มสนทนา" : "ไม่ระบุชื่อ";
            let image = null;
            if (conv.type === "DIRECT" && others.length > 0) {
                title = others[0].user.displayName || "Unknown";
                image = others[0].user.profilePictureUrl;
            }
            else if (conv.class) {
                title = conv.class.title;
            }
            const lastMessage = conv.messages.length > 0 ? conv.messages[0] : null;
            let unreadCount = 0;
            if (me) {
                unreadCount = await database_1.prisma.message.count({
                    where: {
                        conversationId: conv.conversationId,
                        senderId: { not: userId },
                        ...(me.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {})
                    }
                });
            }
            return {
                id: conv.conversationId,
                type: conv.type,
                title,
                image,
                lastMessage: lastMessage ? {
                    content: lastMessage.content,
                    sender: lastMessage.senderId === userId ? "คุณ" : lastMessage.sender.displayName,
                    createdAt: lastMessage.createdAt,
                } : null,
                unreadCount,
                updatedAt: conv.updatedAt,
            };
        }));
        res.status(200).json({ conversations: formattedConversations });
    }
    catch (error) {
        console.error("Failed to fetch conversations", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getConversations = getConversations;
// Get messages for a specific conversation
const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        // Verify participation
        const participant = await database_1.prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId,
                },
            },
            include: {
                conversation: {
                    include: {
                        participants: {
                            include: {
                                user: {
                                    select: {
                                        userId: true,
                                        displayName: true,
                                        profilePictureUrl: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!participant) {
            res.status(403).json({ error: "Not a participant in this conversation" });
            return;
        }
        const messages = await database_1.prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
            include: {
                sender: {
                    select: {
                        userId: true,
                        displayName: true,
                        profilePictureUrl: true,
                    },
                },
            },
        });
        // Mark as read
        await database_1.prisma.conversationParticipant.update({
            where: { participantId: participant.participantId },
            data: { lastReadAt: new Date() },
        });
        const others = participant.conversation.participants.filter(p => p.userId !== userId);
        let title = participant.conversation.type === "GROUP" ? "กลุ่มสนทนา" : "ไม่ระบุชื่อ";
        let image = null;
        let fallbackIcon = "User";
        if (participant.conversation.type === "DIRECT" && others.length > 0) {
            title = others[0].user.displayName || "Unknown";
            image = others[0].user.profilePictureUrl;
            fallbackIcon = "User";
        }
        res.status(200).json({
            metadata: {
                id: conversationId,
                title,
                image,
                fallbackIcon,
                status: "ออนไลน์"
            },
            messages: messages.map(m => ({
                id: m.messageId,
                text: m.content,
                senderId: m.senderId,
                senderName: m.sender.displayName,
                senderImage: m.sender.profilePictureUrl,
                time: typeof m.createdAt === 'string' ? m.createdAt : m.createdAt.toISOString(),
                isOwn: m.senderId === userId,
            }))
        });
    }
    catch (error) {
        console.error("Failed to fetch messages", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getMessages = getMessages;
// Send a new message
const sendMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content } = req.body;
        const userId = req.user?.userId;
        if (!userId || !content) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        // Verify participation
        const participant = await database_1.prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId,
                },
            },
        });
        if (!participant) {
            res.status(403).json({ error: "Not a participant in this conversation" });
            return;
        }
        const newMessage = await database_1.prisma.message.create({
            data: {
                conversationId,
                senderId: userId,
                content,
            },
            include: {
                sender: {
                    select: {
                        userId: true,
                        displayName: true,
                        profilePictureUrl: true,
                    },
                },
            },
        });
        // Update conversation timestamp
        await database_1.prisma.conversation.update({
            where: { conversationId },
            data: { updatedAt: new Date() },
        });
        // Trigger async Line Push Notifications to other participants
        (async () => {
            try {
                const allParticipants = await database_1.prisma.conversationParticipant.findMany({
                    where: { conversationId, userId: { not: userId } },
                    select: { userId: true }
                });
                const senderName = newMessage.sender.displayName || "มีข้อความใหม่";
                const shortContent = content.length > 100 ? content.substring(0, 97) + "..." : content;
                const deepLink = LineNotificationService_1.LineNotificationService.buildLiffDeepLink(`/chat/${conversationId}`);
                const pushMessage = deepLink
                    ? `💬 จาก ${senderName}:\n${shortContent}\n\n${deepLink}`
                    : `💬 จาก ${senderName}:\n${shortContent}`;
                for (const p of allParticipants) {
                    await LineNotificationService_1.LineNotificationService.sendToUser(p.userId, pushMessage, { type: "notifyLineMessages" });
                }
            }
            catch (e) {
                console.error("Background Notification Error:", e);
            }
        })();
        res.status(201).json({
            id: newMessage.messageId,
            text: newMessage.content,
            senderId: newMessage.senderId,
            senderName: newMessage.sender.displayName,
            senderImage: newMessage.sender.profilePictureUrl,
            time: newMessage.createdAt.toISOString(),
            isOwn: true,
        });
    }
    catch (error) {
        console.error("Failed to send message", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.sendMessage = sendMessage;
// Initiate or retrieve an existing conversation
const initiateChat = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { classId, type, targetUserId } = req.body;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        if (!type || !['DIRECT', 'GROUP'].includes(type)) {
            res.status(400).json({ error: "Invalid chat type" });
            return;
        }
        // Group conversation linked to a class
        if (type === 'GROUP') {
            if (!classId) {
                res.status(400).json({ error: "classId is required for group chats" });
                return;
            }
            let conversation = await database_1.prisma.conversation.findFirst({
                where: { classId, type: 'GROUP' }
            });
            if (!conversation) {
                conversation = await database_1.prisma.conversation.create({
                    data: {
                        classId,
                        type: 'GROUP'
                    }
                });
            }
            // Ensure requester is a participant
            await database_1.prisma.conversationParticipant.upsert({
                where: {
                    conversationId_userId: {
                        conversationId: conversation.conversationId,
                        userId: userId
                    }
                },
                update: {},
                create: {
                    conversationId: conversation.conversationId,
                    userId: userId
                }
            });
            res.status(200).json({ conversationId: conversation.conversationId });
            return;
        }
        // Direct conversation between two users
        if (type === 'DIRECT') {
            if (!targetUserId) {
                res.status(400).json({ error: "targetUserId is required for direct chats" });
                return;
            }
            // Find a conversation that contains exactly these two participants
            const existingConversations = await database_1.prisma.conversation.findMany({
                where: {
                    type: 'DIRECT',
                    AND: [
                        { participants: { some: { userId: userId } } },
                        { participants: { some: { userId: targetUserId } } }
                    ]
                },
                include: { participants: true }
            });
            // Ensure strictly 2 participants to count as a clean direct chat
            let existingConv = existingConversations.find(c => c.participants.length === 2);
            if (existingConv) {
                res.status(200).json({ conversationId: existingConv.conversationId });
                return;
            }
            // Create new direct conversation
            const newConv = await database_1.prisma.conversation.create({
                data: {
                    type: 'DIRECT',
                    classId: classId || null,
                    participants: {
                        create: [
                            { userId: userId },
                            { userId: targetUserId }
                        ]
                    }
                }
            });
            res.status(201).json({ conversationId: newConv.conversationId });
            return;
        }
    }
    catch (error) {
        console.error("Failed to initiate conversation:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.initiateChat = initiateChat;
