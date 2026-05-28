"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.devSeedLessonHistory = devSeedLessonHistory;
exports.devSeedFullProgress = devSeedFullProgress;
exports.devPurgeLessonHistory = devPurgeLessonHistory;
exports.devActivateEnrollments = devActivateEnrollments;
exports.devSeedClassAllProgress = devSeedClassAllProgress;
exports.devOnly = devOnly;
const database_1 = require("@tutor-advantage/database");
// ─── POST /v1/dev/seed/lesson-history ────────────────────────────────────────
// Seeds FINISHED InteractiveSessions + participations for the current student
// based on their first ACTIVE enrollment's book articles.
async function devSeedLessonHistory(req, res) {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    // 1. Find first active enrollment with class + book + articles
    const enrollment = await database_1.prisma.enrollment.findFirst({
        where: { studentUserId: userId, status: { in: ["ACTIVE", "PENDING_PAYMENT"] } },
        include: {
            class: {
                include: {
                    book: {
                        include: {
                            articles: { orderBy: { articleId: "asc" }, take: 5 },
                        },
                    },
                },
            },
        },
    });
    if (!enrollment) {
        return res.status(404).json({ error: "No active enrollment found — enroll in a class first" });
    }
    const { class: cls } = enrollment;
    const articles = cls.book.articles;
    if (articles.length === 0) {
        return res.status(404).json({ error: "No articles found for this class's book" });
    }
    // 2. Find a few other STUDENT users for realistic peer ranking
    const peers = await database_1.prisma.user.findMany({
        where: { role: "STUDENT", isActive: true, userId: { not: userId } },
        select: { userId: true },
        take: 3,
    });
    const peerScores = [78, 65, 88];
    const now = Date.now();
    const DAY_MS = 86_400_000;
    const seededSessionIds = [];
    // 3. Seed one FINISHED session per article
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        // Spread sessions across the past 7 days so streak/history looks realistic
        const sessionDate = new Date(now - (articles.length - i) * DAY_MS);
        const session = await database_1.prisma.interactiveSession.create({
            data: {
                classId: cls.classId,
                bookId: cls.bookId,
                tutorUserId: cls.tutorUserId,
                articleId: article.articleId,
                status: "FINISHED",
                createdAt: sessionDate,
                updatedAt: sessionDate,
            },
        });
        const myScore = 60 + Math.floor(Math.random() * 40); // 60–100
        // Student participant
        await database_1.prisma.sessionParticipant.create({
            data: {
                sessionId: session.sessionId,
                studentUserId: userId,
                score: myScore,
                joinedAt: sessionDate,
            },
        });
        // Peer participants (skip if no peers exist)
        for (let p = 0; p < peers.length; p++) {
            await database_1.prisma.sessionParticipant.upsert({
                where: {
                    sessionId_studentUserId: {
                        sessionId: session.sessionId,
                        studentUserId: peers[p].userId,
                    },
                },
                create: {
                    sessionId: session.sessionId,
                    studentUserId: peers[p].userId,
                    score: peerScores[p] ?? 50,
                    joinedAt: sessionDate,
                },
                update: {},
            });
        }
        // Seed session answers for the student (2 phases)
        await database_1.prisma.sessionAnswer.createMany({
            data: [
                {
                    sessionId: session.sessionId,
                    studentUserId: userId,
                    phase: 1,
                    questionText: "[DEV] Vocabulary question",
                    answerText: "Dev seeded answer",
                    correctAnswer: "Dev seeded answer",
                    isCorrect: true,
                    score: Math.floor(myScore * 0.5),
                    answeredAt: sessionDate,
                },
                {
                    sessionId: session.sessionId,
                    studentUserId: userId,
                    phase: 2,
                    questionText: "[DEV] Comprehension question",
                    answerText: "Dev seeded answer",
                    correctAnswer: "Dev seeded answer",
                    isCorrect: myScore >= 70,
                    score: Math.floor(myScore * 0.5),
                    answeredAt: sessionDate,
                },
            ],
            skipDuplicates: true,
        });
        seededSessionIds.push(session.sessionId);
    }
    return res.status(201).json({
        seeded: seededSessionIds.length,
        sessions: seededSessionIds,
        class: cls.title,
        articles: articles.map((a) => a.articleId),
    });
}
// ─── POST /v1/dev/seed/full-progress ─────────────────────────────────────────
// Seeds FINISHED sessions for EVERY article in the student's enrolled book,
// spread over multiple weeks so streak/progress/weekly-activity all reflect
// a "fully completed" state.
async function devSeedFullProgress(req, res) {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    // 1. Find first ACTIVE enrollment
    const enrollment = await database_1.prisma.enrollment.findFirst({
        where: { studentUserId: userId, status: { in: ["ACTIVE", "PENDING_PAYMENT"] } },
        include: {
            class: {
                include: {
                    book: {
                        include: {
                            articles: { orderBy: { articleId: "asc" } }, // ALL articles
                        },
                    },
                },
            },
        },
    });
    if (!enrollment) {
        return res.status(404).json({ error: "No active enrollment found" });
    }
    const { class: cls } = enrollment;
    const articles = cls.book.articles;
    if (articles.length === 0) {
        return res.status(404).json({ error: "No articles found for this class's book" });
    }
    // 2. Find peers for realistic ranking
    const peers = await database_1.prisma.user.findMany({
        where: { role: "STUDENT", isActive: true, userId: { not: userId } },
        select: { userId: true },
        take: 3,
    });
    const peerScores = [78, 65, 88];
    const now = Date.now();
    const DAY_MS = 86_400_000;
    // Spread sessions backwards — one per article, ~1 per day
    // This ensures multiple weeks are covered → streak grows naturally
    const seededSessionIds = [];
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        // Place sessions from furthest-past to most recent
        const daysAgo = articles.length - 1 - i;
        const sessionDate = new Date(now - daysAgo * DAY_MS);
        // Skip if session for this article already exists for this student
        const existing = await database_1.prisma.sessionParticipant.findFirst({
            where: {
                studentUserId: userId,
                session: { articleId: article.articleId, status: "FINISHED", classId: cls.classId },
            },
        });
        if (existing)
            continue;
        const session = await database_1.prisma.interactiveSession.create({
            data: {
                classId: cls.classId,
                bookId: cls.bookId,
                tutorUserId: cls.tutorUserId,
                articleId: article.articleId,
                status: "FINISHED",
                createdAt: sessionDate,
                updatedAt: new Date(sessionDate.getTime() + 30 * 60 * 1000), // +30 min duration
            },
        });
        const myScore = 60 + Math.floor(Math.random() * 40);
        await database_1.prisma.sessionParticipant.create({
            data: { sessionId: session.sessionId, studentUserId: userId, score: myScore, joinedAt: sessionDate },
        });
        for (let p = 0; p < peers.length; p++) {
            await database_1.prisma.sessionParticipant.upsert({
                where: { sessionId_studentUserId: { sessionId: session.sessionId, studentUserId: peers[p].userId } },
                create: { sessionId: session.sessionId, studentUserId: peers[p].userId, score: peerScores[p] ?? 50, joinedAt: sessionDate },
                update: {},
            });
        }
        await database_1.prisma.sessionAnswer.createMany({
            data: [
                {
                    sessionId: session.sessionId, studentUserId: userId, phase: 1,
                    questionText: "[DEV] Vocabulary question", answerText: "Dev seeded answer",
                    correctAnswer: "Dev seeded answer", isCorrect: true,
                    score: Math.floor(myScore * 0.5), answeredAt: sessionDate,
                },
                {
                    sessionId: session.sessionId, studentUserId: userId, phase: 2,
                    questionText: "[DEV] Comprehension question", answerText: "Dev seeded answer",
                    correctAnswer: "Dev seeded answer", isCorrect: myScore >= 70,
                    score: Math.floor(myScore * 0.5), answeredAt: sessionDate,
                },
            ],
            skipDuplicates: true,
        });
        seededSessionIds.push(session.sessionId);
    }
    return res.status(201).json({
        seeded: seededSessionIds.length,
        skipped: articles.length - seededSessionIds.length,
        totalArticles: articles.length,
        class: cls.title,
        book: cls.book.title,
    });
}
// ─── DELETE /v1/dev/seed/lesson-history ──────────────────────────────────────
// Removes all FINISHED sessions where the current student participated.
async function devPurgeLessonHistory(req, res) {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    // Find all FINISHED sessions this student participated in
    const participations = await database_1.prisma.sessionParticipant.findMany({
        where: { studentUserId: userId, session: { status: "FINISHED" } },
        select: { sessionId: true },
    });
    const sessionIds = participations.map((p) => p.sessionId);
    if (sessionIds.length === 0) {
        return res.status(200).json({ deleted: 0, message: "No finished sessions to purge" });
    }
    // Delete in order: answers → participants → sessions
    await database_1.prisma.sessionAnswer.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await database_1.prisma.sessionParticipant.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await database_1.prisma.interactiveSession.deleteMany({
        where: { sessionId: { in: sessionIds }, status: "FINISHED" },
    });
    return res.status(200).json({ deleted: sessionIds.length });
}
// ─── POST /v1/dev/seed/enrollments ───────────────────────────────────────────
// Marks all PENDING_PAYMENT enrollments for the student as ACTIVE.
async function devActivateEnrollments(req, res) {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const result = await database_1.prisma.enrollment.updateMany({
        where: { studentUserId: userId, status: "PENDING_PAYMENT" },
        data: { status: "ACTIVE", updatedAt: new Date() },
    });
    return res.status(200).json({ activated: result.count });
}
// ─── POST /v1/dev/seed/class-all-progress ────────────────────────────────────
// Seeds FINISHED InteractiveSessions + participations for EVERY enrolled student
// in a given class. Useful for simulating a fully-completed classroom before
// testing the upclass / book-cycle progression flow.
async function devSeedClassAllProgress(req, res) {
    const { classId } = req.body;
    if (!classId)
        return res.status(400).json({ error: "classId is required" });
    // 1. Fetch class with its book + all articles
    const cls = await database_1.prisma.class.findUnique({
        where: { classId },
        include: {
            book: { include: { articles: { orderBy: { articleId: "asc" } } } },
        },
    });
    if (!cls)
        return res.status(404).json({ error: "Class not found" });
    // 2. Get all ACTIVE enrolled students
    const enrollments = await database_1.prisma.enrollment.findMany({
        where: { classId, status: "ACTIVE" },
        select: { studentUserId: true },
    });
    if (enrollments.length === 0) {
        return res.status(404).json({ error: "No active enrollments — activate enrollments first" });
    }
    const studentIds = enrollments.map((e) => e.studentUserId);
    const articles = cls.book.articles;
    const now = Date.now();
    const DAY_MS = 86_400_000;
    let sessionsCreated = 0;
    let skipped = 0;
    // 3. For each article, create one FINISHED session with all students as participants
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        const daysAgo = articles.length - 1 - i;
        const sessionDate = new Date(now - daysAgo * DAY_MS);
        // Skip if a FINISHED session already exists for this article in this class
        const existing = await database_1.prisma.interactiveSession.findFirst({
            where: { classId, articleId: article.articleId, status: "FINISHED" },
        });
        if (existing) {
            skipped++;
            continue;
        }
        const session = await database_1.prisma.interactiveSession.create({
            data: {
                classId,
                bookId: cls.bookId,
                tutorUserId: cls.tutorUserId,
                articleId: article.articleId,
                status: "FINISHED",
                createdAt: sessionDate,
                updatedAt: new Date(sessionDate.getTime() + 30 * 60_000),
            },
        });
        // Create participant + answer records for every enrolled student
        for (const studentId of studentIds) {
            const score = 60 + Math.floor(Math.random() * 40); // 60–100
            await database_1.prisma.sessionParticipant.upsert({
                where: { sessionId_studentUserId: { sessionId: session.sessionId, studentUserId: studentId } },
                create: { sessionId: session.sessionId, studentUserId: studentId, score, joinedAt: sessionDate },
                update: {},
            });
            await database_1.prisma.sessionAnswer.createMany({
                data: [
                    {
                        sessionId: session.sessionId, studentUserId: studentId, phase: 1,
                        questionText: "[DEV] Vocabulary question", answerText: "Dev seeded answer",
                        correctAnswer: "Dev seeded answer", isCorrect: true,
                        score: Math.floor(score * 0.5), answeredAt: sessionDate,
                    },
                    {
                        sessionId: session.sessionId, studentUserId: studentId, phase: 2,
                        questionText: "[DEV] Comprehension question", answerText: "Dev seeded answer",
                        correctAnswer: "Dev seeded answer", isCorrect: score >= 70,
                        score: Math.floor(score * 0.5), answeredAt: sessionDate,
                    },
                ],
                skipDuplicates: true,
            });
        }
        sessionsCreated++;
    }
    return res.status(201).json({
        classId,
        className: cls.title,
        bookTitle: cls.book.title,
        studentsProcessed: studentIds.length,
        articlesTotal: articles.length,
        sessionsCreated,
        skipped,
    });
}
// ─── Dev-only middleware ──────────────────────────────────────────────────────
function devOnly(_req, res, next) {
    if (process.env.NODE_ENV !== "development") {
        return res.status(403).json({ error: "Not available in production" });
    }
    next();
}
