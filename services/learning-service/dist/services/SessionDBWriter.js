"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSessionStatus = exports.persistAnswer = exports.persistSessionParticipant = exports.persistSessionStart = exports.resolveUserId = void 0;
const database_1 = require("@tutor-advantage/database");
const resolveUserId = async (inputId) => {
    if (!inputId || inputId === "anonymous")
        return null;
    // 1. Check if it's already a valid UUID in the User table
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(inputId);
    if (isUuid) {
        const user = await database_1.prisma.user.findUnique({ where: { userId: inputId } });
        if (user)
            return user.userId;
    }
    // 2. Try resolving via OAuthIdentity (Line / external provider subjects)
    // Often LINE IDs aren't UUIDs.
    const identity = await database_1.prisma.oAuthIdentity.findFirst({
        where: { providerSubject: inputId },
        select: { userId: true }
    });
    if (identity) {
        return identity.userId;
    }
    // 3. If not found, we cannot create constraints safely. Fallback to null.
    return null;
};
exports.resolveUserId = resolveUserId;
const persistSessionStart = async (sessionId, tutorId, articleId, classId) => {
    try {
        let resolvedTutorId = await (0, exports.resolveUserId)(tutorId);
        // If placeholder ID (like tutor-123) fails, try to resolve via Class owner!
        if (!resolvedTutorId && classId) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId);
            if (isUuid) {
                const cls = await database_1.prisma.class.findUnique({ where: { classId }, select: { tutorUserId: true } });
                if (cls) {
                    resolvedTutorId = cls.tutorUserId;
                    console.log(`[SessionDB] Resolved tutor ID ${resolvedTutorId} from Class ${classId}`);
                }
            }
        }
        // Final dev fallback: pick any Tutor if all else fails, rather than crashing
        if (!resolvedTutorId) {
            const fallback = await database_1.prisma.user.findFirst({ where: { role: "TUTOR" }, select: { userId: true } });
            if (fallback) {
                resolvedTutorId = fallback.userId;
                console.log(`[SessionDB] Fallback: Using general Tutor ${resolvedTutorId}`);
            }
        }
        if (!resolvedTutorId) {
            console.warn(`[SessionDB] Cannot create session entry: Tutor ID not found & could not resolve via Class/Role.`);
            return;
        }
        // Validate classId format before inserting into DB (must be UUID)
        const dbClassId = (classId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId)) ? classId : null;
        // Ensure InteractiveSession entry exists
        await database_1.prisma.interactiveSession.upsert({
            where: { sessionId },
            create: {
                sessionId,
                tutorUserId: resolvedTutorId,
                articleId,
                classId: dbClassId,
                status: "ACTIVE"
            },
            update: {
                status: "ACTIVE" // reopen if needed
            }
        });
    }
    catch (error) {
        console.error(`[SessionDB] Error persisting session start:`, error);
    }
};
exports.persistSessionStart = persistSessionStart;
const persistSessionParticipant = async (sessionId, studentId) => {
    try {
        let resolvedStudentId = await (0, exports.resolveUserId)(studentId);
        if (!resolvedStudentId) {
            // Dev fallback: if student not found, try fallback to any existing student user
            const fallback = await database_1.prisma.user.findFirst({ where: { role: "STUDENT" }, select: { userId: true } });
            if (fallback) {
                resolvedStudentId = fallback.userId;
                console.log(`[SessionDB] Resolved student via Fallback: ${resolvedStudentId}`);
            }
        }
        if (!resolvedStudentId)
            return;
        await database_1.prisma.sessionParticipant.upsert({
            where: {
                sessionId_studentUserId: {
                    sessionId,
                    studentUserId: resolvedStudentId
                }
            },
            create: {
                sessionId,
                studentUserId: resolvedStudentId,
                score: 0
            },
            update: {} // already exists
        });
    }
    catch (error) {
        console.error(`[SessionDB] Error persisting session participant:`, error);
    }
};
exports.persistSessionParticipant = persistSessionParticipant;
const persistAnswer = async (params) => {
    try {
        let resolvedStudentId = await (0, exports.resolveUserId)(params.studentId);
        if (!resolvedStudentId) {
            const fallback = await database_1.prisma.user.findFirst({ where: { role: "STUDENT" }, select: { userId: true } });
            if (fallback) {
                resolvedStudentId = fallback.userId;
                console.log(`[SessionDB] Resolved student for answer via Fallback: ${resolvedStudentId}`);
            }
        }
        if (!resolvedStudentId)
            return;
        // 1. Ensure both session and participant records exist just in case
        // Upserting dynamically ensures robustness
        await database_1.prisma.sessionParticipant.upsert({
            where: { sessionId_studentUserId: { sessionId: params.sessionId, studentUserId: resolvedStudentId } },
            create: { sessionId: params.sessionId, studentUserId: resolvedStudentId, score: 0 },
            update: {}
        });
        // 2. Create Answer log
        await database_1.prisma.sessionAnswer.create({
            data: {
                sessionId: params.sessionId,
                studentUserId: resolvedStudentId,
                phase: params.phase,
                answerText: params.answerText,
                isCorrect: params.isCorrect,
                score: params.score,
                aiFeedback: params.aiFeedback,
                questionText: params.questionText,
                correctAnswer: params.correctAnswer,
                options: params.options || undefined
            }
        });
        // 3. Update running total on participant tally in the DB
        await database_1.prisma.sessionParticipant.update({
            where: { sessionId_studentUserId: { sessionId: params.sessionId, studentUserId: resolvedStudentId } },
            data: {
                score: { increment: params.score }
            }
        });
    }
    catch (error) {
        console.error(`[SessionDB] Error saving answer:`, error);
    }
};
exports.persistAnswer = persistAnswer;
const updateSessionStatus = async (sessionId, status) => {
    try {
        await database_1.prisma.interactiveSession.updateMany({
            where: { sessionId },
            data: { status }
        });
    }
    catch (error) {
        console.error(`[SessionDB] Error updating session status:`, error);
    }
};
exports.updateSessionStatus = updateSessionStatus;
