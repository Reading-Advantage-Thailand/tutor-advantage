/**
 * devController.ts
 *
 * DEV-ONLY endpoints for seeding / purging test data in the learning service.
 * All routes are guarded by the devOnly middleware — unreachable in production.
 */
import { Request, Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

// ─── POST /v1/dev/seed/lesson-history ────────────────────────────────────────
// Seeds FINISHED InteractiveSessions + participations for the current student
// based on their first ACTIVE enrollment's book articles.

export async function devSeedLessonHistory(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // 1. Find first active enrollment with class + book + articles
  const enrollment = await prisma.enrollment.findFirst({
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
  const peers = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true, userId: { not: userId } },
    select: { userId: true },
    take: 3,
  });

  const peerScores = [78, 65, 88];
  const now = Date.now();
  const DAY_MS = 86_400_000;

  const seededSessionIds: string[] = [];

  // 3. Seed one FINISHED session per article
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];

    // Spread sessions across the past 7 days so streak/history looks realistic
    const sessionDate = new Date(now - (articles.length - i) * DAY_MS);

    const session = await prisma.interactiveSession.create({
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
    await prisma.sessionParticipant.create({
      data: {
        sessionId: session.sessionId,
        studentUserId: userId,
        score: myScore,
        joinedAt: sessionDate,
      },
    });

    // Peer participants (skip if no peers exist)
    for (let p = 0; p < peers.length; p++) {
      await prisma.sessionParticipant.upsert({
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
    await prisma.sessionAnswer.createMany({
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

export async function devSeedFullProgress(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // 1. Find first ACTIVE enrollment
  const enrollment = await prisma.enrollment.findFirst({
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
  const peers = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true, userId: { not: userId } },
    select: { userId: true },
    take: 3,
  });
  const peerScores = [78, 65, 88];

  const now = Date.now();
  const DAY_MS = 86_400_000;
  // Spread sessions backwards — one per article, ~1 per day
  // This ensures multiple weeks are covered → streak grows naturally
  const seededSessionIds: string[] = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];

    // Place sessions from furthest-past to most recent
    const daysAgo = articles.length - 1 - i;
    const sessionDate = new Date(now - daysAgo * DAY_MS);

    // Skip if session for this article already exists for this student
    const existing = await prisma.sessionParticipant.findFirst({
      where: {
        studentUserId: userId,
        session: { articleId: article.articleId, status: "FINISHED", classId: cls.classId },
      },
    });
    if (existing) continue;

    const session = await prisma.interactiveSession.create({
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

    await prisma.sessionParticipant.create({
      data: { sessionId: session.sessionId, studentUserId: userId, score: myScore, joinedAt: sessionDate },
    });

    for (let p = 0; p < peers.length; p++) {
      await prisma.sessionParticipant.upsert({
        where: { sessionId_studentUserId: { sessionId: session.sessionId, studentUserId: peers[p].userId } },
        create: { sessionId: session.sessionId, studentUserId: peers[p].userId, score: peerScores[p] ?? 50, joinedAt: sessionDate },
        update: {},
      });
    }

    await prisma.sessionAnswer.createMany({
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

export async function devPurgeLessonHistory(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // Find all FINISHED sessions this student participated in
  const participations = await prisma.sessionParticipant.findMany({
    where: { studentUserId: userId, session: { status: "FINISHED" } },
    select: { sessionId: true },
  });

  const sessionIds = participations.map((p) => p.sessionId);

  if (sessionIds.length === 0) {
    return res.status(200).json({ deleted: 0, message: "No finished sessions to purge" });
  }

  // Delete in order: answers → participants → sessions
  await prisma.sessionAnswer.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.sessionParticipant.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.interactiveSession.deleteMany({
    where: { sessionId: { in: sessionIds }, status: "FINISHED" },
  });

  return res.status(200).json({ deleted: sessionIds.length });
}

// ─── POST /v1/dev/seed/enrollments ───────────────────────────────────────────
// Marks all PENDING_PAYMENT enrollments for the student as ACTIVE.

export async function devActivateEnrollments(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const result = await prisma.enrollment.updateMany({
    where: { studentUserId: userId, status: "PENDING_PAYMENT" },
    data: { status: "ACTIVE", updatedAt: new Date() },
  });

  return res.status(200).json({ activated: result.count });
}

// ─── Dev-only middleware ──────────────────────────────────────────────────────

export function devOnly(_req: Request, res: Response, next: () => void) {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({ error: "Not available in production" });
  }
  next();
}
