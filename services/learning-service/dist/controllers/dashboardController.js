"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardSummary = getDashboardSummary;
exports.getStudentProgress = getStudentProgress;
exports.getStudentArticle = getStudentArticle;
exports.generateStudentShareLink = generateStudentShareLink;
const shared_config_1 = require("@tutor-advantage/shared-config");
const database_1 = require("@tutor-advantage/database");
const LessonSessionService_1 = require("../services/LessonSessionService");
const ReadingAdvantageDB_1 = require("../services/ReadingAdvantageDB");
const classController_1 = require("./classController");
const uuid_1 = require("uuid");
const STUDENT_APP_PROD_URL = "https://student-liff-1090865515742.asia-southeast1.run.app";
const STUDENT_APP_DEV_URL = "https://resource-pushpin-tabby.ngrok-free.dev";
function getStudentAppBaseUrl() {
    return process.env.FRONTEND_APP_URL ||
        (process.env.NODE_ENV === "production" ? STUDENT_APP_PROD_URL : STUDENT_APP_DEV_URL);
}
function getValidDateQuery(value) {
    if (typeof value !== "string")
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
async function getUnreadMessageCount(userId) {
    const rows = await database_1.prisma.$queryRaw `
    SELECT COUNT(*)::bigint AS count
    FROM learning.messages m
    INNER JOIN learning.conversation_participants cp
      ON cp.conversation_id = m.conversation_id
    WHERE cp.user_id = CAST(${userId} AS uuid)
      AND m.sender_id <> CAST(${userId} AS uuid)
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
  `;
    return Number(rows[0]?.count ?? 0);
}
async function getDashboardHistory(userId, from, to) {
    const participations = await database_1.prisma.sessionParticipant.findMany({
        where: {
            studentUserId: userId,
            joinedAt: { gte: from, lt: to },
            session: { status: "FINISHED" },
        },
        include: {
            session: {
                include: {
                    tutor: { select: { displayName: true } },
                    participants: { select: { studentUserId: true, score: true } },
                },
            },
        },
        orderBy: { joinedAt: "desc" },
        take: 20,
    });
    return Promise.all(participations.map(async (participation) => {
        const session = participation.session;
        const articleInfo = await (0, ReadingAdvantageDB_1.getArticleDetails)(session.articleId).catch(() => null);
        const sortedPeers = [...session.participants].sort((a, b) => (b.score || 0) - (a.score || 0));
        const myRank = sortedPeers.findIndex((peer) => peer.studentUserId === userId) + 1;
        return {
            sessionId: session.sessionId,
            articleId: session.articleId,
            articleTitle: articleInfo?.title || "บทเรียนไร้ชื่อ",
            articleLevel: articleInfo?.cefr_level || "N/A",
            tutorName: session.tutor.displayName || "Tutor",
            score: participation.score,
            rank: myRank,
            totalParticipants: sortedPeers.length,
            date: participation.joinedAt,
            status: session.status,
        };
    }));
}
async function getDashboardSummary(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "User not identified" },
            });
        }
        const role = req.user?.role;
        if (role === "STUDENT") {
            // 1. Fetch student enrollments
            const enrollments = await database_1.prisma.enrollment.findMany({
                where: { studentUserId: userId, status: "ACTIVE" },
                include: {
                    class: {
                        include: {
                            book: {
                                include: {
                                    series: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: "desc" }
            });
            const pendingPackages = await database_1.prisma.enrollmentPackage.findMany({
                where: { studentUserId: userId, status: "PENDING_PAYMENT" },
                include: {
                    classBookCycle: {
                        include: {
                            book: { include: { series: true } },
                            class: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            });
            const tutorIds = Array.from(new Set([
                ...enrollments.map((e) => e.class.tutorUserId).filter(Boolean),
                ...pendingPackages.map((p) => p.classBookCycle.class.tutorUserId).filter(Boolean),
            ]));
            const tutors = await database_1.prisma.user.findMany({
                where: { userId: { in: tutorIds } },
                select: { userId: true, displayName: true }
            });
            const tutorMap = new Map(tutors.map((t) => [t.userId, t.displayName]));
            // 2. Calculate read articles
            const readParticipations = await database_1.prisma.sessionParticipant.findMany({
                where: {
                    studentUserId: userId,
                    session: { status: "FINISHED" }
                },
                select: {
                    joinedAt: true,
                    session: { select: { articleId: true, bookId: true, createdAt: true } }
                }
            });
            const distinctArticlesRead = new Set(readParticipations.map((p) => `${p.session.bookId || "legacy"}:${p.session.articleId}`));
            // 3. Calculate consecutive week streak (counting backwards from current week)
            const today = new Date();
            const getWeekId = (d) => {
                const copy = new Date(d);
                copy.setHours(0, 0, 0, 0);
                const firstJan = new Date(copy.getFullYear(), 0, 1);
                return `${copy.getFullYear()}-W${Math.ceil((((copy.getTime() - firstJan.getTime()) / 86400000) + firstJan.getDay() + 1) / 7)}`;
            };
            const activeWeeks = new Set(readParticipations.map((p) => getWeekId(new Date(p.joinedAt || p.session.createdAt))));
            let streak = 0;
            let checkDate = new Date(today);
            while (true) {
                const weekId = getWeekId(checkDate);
                if (activeWeeks.has(weekId)) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 7); // Move back 1 week
                }
                else {
                    break;
                }
            }
            const bookIds = Array.from(new Set(enrollments.map((e) => e.class.bookId).filter(Boolean)));
            const articles = await database_1.prisma.article.findMany({
                where: { bookId: { in: bookIds } },
                select: { bookId: true, articleId: true },
            });
            const articleIdsByBookId = new Map();
            for (const article of articles) {
                const bookArticles = articleIdsByBookId.get(article.bookId) ?? [];
                bookArticles.push(article.articleId);
                articleIdsByBookId.set(article.bookId, bookArticles);
            }
            const classSummaries = enrollments.map((e) => {
                const session = LessonSessionService_1.lessonSessionService.getSessionByClassId(e.class.classId);
                const tutorName = tutorMap.get(e.class.tutorUserId) || "Tutor";
                // Calculate actual class progress based on current book articles read
                const bookArticleIds = articleIdsByBookId.get(e.class.bookId) ?? [];
                const articlesCompletedInClass = bookArticleIds.filter(id => distinctArticlesRead.has(`${e.class.bookId}:${id}`) ||
                    distinctArticlesRead.has(`legacy:${id}`)).length;
                const totalArticlesInBook = bookArticleIds.length || e.class.book?.articleCount || 10;
                const actualProgress = Math.round((articlesCompletedInClass / totalArticlesInBook) * 100);
                return {
                    id: e.class.classId,
                    name: e.class.title || e.class.book?.title || "Untitled Class",
                    status: e.class.status.toLowerCase(),
                    tutorName,
                    nextSession: (0, classController_1.formatNextSession)(e.class.scheduleDescription, e.class.scheduleData),
                    progress: actualProgress,
                    isLive: !!session,
                    bookName: e.class.book?.title,
                    seriesCefr: e.class.book?.series?.cefrLevel || "A1",
                };
            });
            const activeEnrollmentClassIds = new Set(enrollments.map((e) => e.class.classId));
            const pendingPackageSummaries = pendingPackages.map((pkg) => {
                const cycle = pkg.classBookCycle;
                const cls = cycle.class;
                const tutorName = tutorMap.get(cls.tutorUserId) || "Tutor";
                // Only include cycleId when enrollment is already ACTIVE (book cycle upgrade).
                // If enrollment is still PENDING_PAYMENT, omit cycleId so the payment page
                // uses the enrollment payment flow instead of prepareClassBookCycleAccess.
                const isUpgradeCycle = activeEnrollmentClassIds.has(cls.classId);
                return {
                    id: cls.classId,
                    cycleId: isUpgradeCycle ? cycle.classBookCycleId : undefined,
                    name: `${cls.title || cycle.book?.title || "Untitled Class"} / ${cycle.book?.title || "New Book"}`,
                    status: pkg.status,
                    tutorName,
                    nextSession: (0, classController_1.formatNextSession)(cls.scheduleDescription, cls.scheduleData),
                    progress: 0,
                    isLive: false,
                    bookName: cycle.book?.title,
                    seriesCefr: cycle.book?.series?.cefrLevel || "A1",
                    price: Number(cycle.packagePriceMinor) / 100,
                };
            });
            const sortedClassSummaries = classSummaries
                .sort((a, b) => Number(b.isLive) - Number(a.isLive));
            const recentClasses = [
                ...pendingPackageSummaries,
                ...sortedClassSummaries.slice(0, Math.max(0, 3 - pendingPackageSummaries.length)),
            ];
            const historyFrom = getValidDateQuery(req.query.historyFrom);
            const historyTo = getValidDateQuery(req.query.historyTo);
            const [totalUnreadMessages, todayHistory] = await Promise.all([
                getUnreadMessageCount(userId),
                historyFrom && historyTo ? getDashboardHistory(userId, historyFrom, historyTo) : Promise.resolve([]),
            ]);
            return res.status(200).json({
                activeEnrollments: enrollments.length,
                totalArticlesRead: distinctArticlesRead.size,
                weekStreak: streak,
                recentClasses,
                shareableClasses: classSummaries,
                unreadMessages: totalUnreadMessages,
                todayHistory,
            });
        }
        // 1. Fetch all classes owned by the tutor (Existing logic for TUTOR)
        const classes = await database_1.prisma.class.findMany({
            where: { tutorUserId: userId },
            include: {
                book: true,
            },
            orderBy: { createdAt: "desc" },
        });
        const openClassesCount = classes.filter((c) => c.status === "OPEN").length;
        // Sum the enrolledCount across all classes
        const totalStudents = classes.reduce((sum, c) => sum + (c.enrolledCount || 0), 0);
        // Filter recent classes for display
        const recentClasses = classes.slice(0, 3).map((c) => ({
            id: c.classId,
            name: c.title || c.book?.title || "Untitled Class",
            status: c.status.toLowerCase(), // OPEN -> open
            students: c.enrolledCount,
            nextSession: (0, classController_1.formatNextSession)(c.scheduleDescription, c.scheduleData),
        }));
        const unreadMessages = await getUnreadMessageCount(userId);
        const classesThisWeek = classes.length > 0 ? Math.min(classes.length, 5) : 0;
        return res.status(200).json({
            openClasses: openClassesCount,
            totalStudents,
            classesThisWeek,
            recentClasses,
            unreadMessages,
        });
    }
    catch (error_err) {
        const error = error_err;
        shared_config_1.logger.error("Dashboard Summary Error:", error);
        return res.status(500).json({
            error: { code: "INTERNAL_SERVER_ERROR", message: error.message },
        });
    }
}
async function getStudentProgress(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const requestedClassId = typeof req.query.classId === "string" ? req.query.classId : null;
        // 1. Fetch ALL active enrollments so the frontend can show a class picker
        const allEnrollments = await database_1.prisma.enrollment.findMany({
            where: { studentUserId: userId, status: "ACTIVE" },
            include: {
                class: {
                    include: {
                        book: { include: { series: true } },
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });
        const enrolledClasses = allEnrollments.map((e) => ({
            classId: e.class.classId,
            name: e.class.title || e.class.book?.title || "Untitled Class",
            cefr: e.class.book?.series?.cefrLevel || "A1",
            bookTitle: e.class.book?.title || null,
            seriesColor: (() => {
                const c = { A1: "#06c755", A2: "#10b981", B1: "#3b82f6", B2: "#8b5cf6", C1: "#f59e0b", C2: "#ef4444" };
                return c[e.class.book?.series?.cefrLevel || "A1"] ?? "#06c755";
            })(),
        }));
        if (allEnrollments.length === 0) {
            return res.status(200).json({
                enrolledClasses: [],
                selectedClassId: null,
                stats: { articlesRead: 0, totalArticles: 0, totalMinutes: 0, weekStreak: 0, level: "N/A", cefr: "N/A", seriesColor: "#06c755", nextMilestone: { at: 5, reward: "⭐ Milestone" } },
                weeklyActivity: [],
                articles: []
            });
        }
        // Pick the requested class, or fall back to the most recent enrollment
        const enrollment = requestedClassId
            ? allEnrollments.find((e) => e.class.classId === requestedClassId) || allEnrollments[0]
            : allEnrollments[0];
        const book = enrollment.class.book;
        // 2. Get total read articles count and full history for weekly logic
        const participations = await database_1.prisma.sessionParticipant.findMany({
            where: { studentUserId: userId, session: { status: "FINISHED" } },
            include: { session: true }
        });
        const distinctArticlesRead = new Set(participations.map(p => `${p.session.bookId || "legacy"}:${p.session.articleId}`));
        // Calculate real session durations from timestamps (cap at 90 min each)
        const sessionDurations = new Map();
        for (const p of participations) {
            const sid = p.session.sessionId;
            if (!sessionDurations.has(sid)) {
                const start = new Date(p.session.createdAt).getTime();
                const end = new Date(p.session.updatedAt).getTime();
                const mins = Math.min(Math.round((end - start) / 60000), 90);
                sessionDurations.set(sid, mins > 0 ? mins : 25);
            }
        }
        const totalMinutes = Array.from(sessionDurations.values()).reduce((s, m) => s + m, 0);
        // Per-article duration: use the session that covered it
        const articleMinutes = new Map();
        for (const p of participations) {
            const aid = p.session.articleId;
            if (!articleMinutes.has(aid)) {
                articleMinutes.set(aid, sessionDurations.get(p.session.sessionId) ?? 25);
            }
        }
        // 3. Get Book Articles — natural sort on trailing number in articleId
        const dbArticles = await database_1.prisma.article.findMany({
            where: { bookId: book.bookId },
            orderBy: [
                { createdAt: "asc" },
                { articleId: "asc" }
            ],
        });
        const articles = dbArticles.map((art, idx) => {
            const isRead = distinctArticlesRead.has(`${book.bookId}:${art.articleId}`) ||
                distinctArticlesRead.has(`legacy:${art.articleId}`);
            return {
                id: art.articleId,
                no: idx + 1,
                title: art.title || "Untitled",
                done: isRead,
                minutes: isRead ? (articleMinutes.get(art.articleId) ?? 25) : 0,
            };
        });
        // 4. Weekly Activity & Streak
        const now = new Date();
        const currentDay = now.getDay();
        const diffToMon = (currentDay === 0 ? -6 : 1) - currentDay;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMon);
        monday.setHours(0, 0, 0, 0);
        const days = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
        const weeklyActivity = days.map((label, i) => {
            const dayDateStart = new Date(monday);
            dayDateStart.setDate(monday.getDate() + i);
            const dayDateEnd = new Date(dayDateStart);
            dayDateEnd.setDate(dayDateStart.getDate() + 1);
            const minsForDay = participations
                .filter(p => {
                const joined = new Date(p.joinedAt);
                return joined >= dayDateStart && joined < dayDateEnd;
            })
                .reduce((sum, p) => sum + (sessionDurations.get(p.session.sessionId) ?? 25), 0);
            return {
                day: label,
                minutes: minsForDay,
                active: minsForDay > 0
            };
        });
        // True consecutive streak logic
        const getWeekId = (d) => {
            const copy = new Date(d);
            copy.setHours(0, 0, 0, 0);
            const firstJan = new Date(copy.getFullYear(), 0, 1);
            return `${copy.getFullYear()}-W${Math.ceil((((copy.getTime() - firstJan.getTime()) / 86400000) + firstJan.getDay() + 1) / 7)}`;
        };
        const activeWeeks = new Set(participations.map((p) => getWeekId(new Date(p.joinedAt || p.session?.createdAt))));
        let streak = 0;
        let checkDate = new Date(now);
        while (true) {
            const weekId = getWeekId(checkDate);
            if (activeWeeks.has(weekId)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 7);
            }
            else {
                break;
            }
        }
        const articlesRead = articles.filter(a => a.done).length;
        const totalArticles = dbArticles.length || book.articleCount || 10;
        // Color varies by CEFR level
        const cefrColors = {
            A1: "#06c755", A2: "#10b981",
            B1: "#3b82f6", B2: "#8b5cf6",
            C1: "#f59e0b", C2: "#ef4444",
        };
        const cefr = book.series?.cefrLevel || "A1";
        const seriesColor = cefrColors[cefr] ?? "#06c755";
        // Next milestone: every 5 articles, or the final article
        const nextMilestoneAt = Math.min(Math.ceil((articlesRead + 1) / 5) * 5, totalArticles);
        const isFinalStretch = nextMilestoneAt === totalArticles;
        const nextMilestone = {
            at: nextMilestoneAt,
            reward: isFinalStretch ? "🎓 จบระดับ!" : `⭐ รางวัล Milestone บทที่ ${nextMilestoneAt}`,
        };
        return res.status(200).json({
            enrolledClasses,
            selectedClassId: enrollment.class.classId,
            stats: {
                articlesRead,
                totalArticles,
                weekStreak: streak,
                totalMinutes,
                level: book.title || "Origins",
                cefr,
                seriesColor,
                nextMilestone,
            },
            weeklyActivity,
            articles,
        });
    }
    catch (error_err) {
        const error = error_err;
        shared_config_1.logger.error("Get Student Progress Error:", error);
        return res.status(500).json({
            error: { code: "INTERNAL_SERVER_ERROR", message: "Could not fetch progress" },
        });
    }
}
/**
 * GET /v1/student/articles/:articleId
 * Returns article content + session history (pre-class or review mode).
 */
async function getStudentArticle(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: "Unauthorized" });
        const { articleId } = req.params;
        // Fetch article content from ReadingAdvantage DB
        const articleData = await (0, ReadingAdvantageDB_1.getArticleDetails)(articleId).catch(() => null);
        if (!articleData) {
            return res.status(404).json({ error: "Article not found" });
        }
        // Check if the student has a FINISHED session for this article
        const participant = await database_1.prisma.sessionParticipant.findFirst({
            where: {
                studentUserId: userId,
                session: { articleId, status: "FINISHED" },
            },
            include: { session: true },
            orderBy: { joinedAt: "desc" },
        });
        if (!participant) {
            return res.status(200).json({
                article: articleData,
                mode: "pre-class",
                session: null,
            });
        }
        // Fetch the student's answers for the session (phases with questions)
        const answers = await database_1.prisma.sessionAnswer.findMany({
            where: { sessionId: participant.sessionId, studentUserId: userId },
            orderBy: { phase: "asc" },
        });
        return res.status(200).json({
            article: articleData,
            mode: "review",
            session: {
                sessionId: participant.sessionId,
                score: participant.score,
                finishedAt: participant.session.updatedAt,
                answers: answers.map((a) => ({
                    phase: a.phase,
                    questionText: a.questionText,
                    answerText: a.answerText,
                    correctAnswer: a.correctAnswer,
                    isCorrect: a.isCorrect,
                    score: a.score,
                    aiFeedback: a.aiFeedback,
                })),
            },
        });
    }
    catch (error_err) {
        const error = error_err;
        shared_config_1.logger.error("Get Student Article Error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * POST /v1/student/share-link
 * Returns (or creates) a shareable referral URL for the student's active class.
 */
async function generateStudentShareLink(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: "Unauthorized" });
        const { classId } = req.body;
        // Find the enrollment to confirm the student is actually in this class
        const enrollment = await database_1.prisma.enrollment.findFirst({
            where: {
                studentUserId: userId,
                status: "ACTIVE",
                ...(classId ? { classId } : {}),
            },
            include: { class: true },
            orderBy: { createdAt: "desc" },
        });
        if (!enrollment) {
            return res.status(404).json({ error: "No active enrollment found" });
        }
        const targetClass = enrollment.class;
        // Reuse an existing ACTIVE referral for this class if one exists
        let referral = await database_1.prisma.referral.findFirst({
            where: { classId: targetClass.classId, status: "ACTIVE" },
        });
        if (!referral) {
            referral = await database_1.prisma.referral.create({
                data: {
                    token: (0, uuid_1.v4)(),
                    classId: targetClass.classId,
                    tutorUserId: targetClass.tutorUserId,
                    status: "ACTIVE",
                },
            });
        }
        const baseUrl = getStudentAppBaseUrl();
        const params = new URLSearchParams({
            classId: targetClass.classId,
            referralToken: referral.token,
        });
        const url = `${baseUrl}/enroll?${params.toString()}`;
        return res.status(200).json({
            url,
            token: referral.token,
            className: targetClass.title,
        });
    }
    catch (error_err) {
        const error = error_err;
        shared_config_1.logger.error("Generate Student Share Link Error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
