import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

const prisma = new PrismaClient();

type MetricSource = "actual" | "historical" | "unavailable";

type MetricValue = {
  value: number | null;
  source: MetricSource;
  sampleSize: number;
};

type StudentBenchmarkMetric = MetricValue & {
  current: number | null;
  target: number;
  level: string;
  correctAnswers: number | null;
  totalAnswers: number | null;
  details: null;
};

type TutorReviewAggregateRow = {
  average: number | null;
  total: number | bigint;
};

const BADGE_MAP: Record<string, { label: string, description: string, icon: string, color: string }> = {
  RISING_STAR: {
    label: "ชั่วโมงสอนทะลุเป้า",
    description: "สอนครบ 50 ชั่วโมง",
    icon: "Star",
    color: "text-amber-500 bg-amber-500/10",
  },
  FAST_RESPONDER: {
    label: "ตอบแชทไว",
    description: "ตอบกลับนักเรียนเฉลี่ยไม่เกิน 15 นาที",
    icon: "Zap",
    color: "text-blue-500 bg-blue-500/10",
  },
  TOP_RATED: {
    label: "ขวัญใจนักเรียน",
    description: "เรตติ้งเฉลี่ยสูงกว่า 4.8",
    icon: "Award",
    color: "text-violet-500 bg-violet-500/10",
  },
  NETWORK_BUILDER: {
    label: "นักสร้างทีม",
    description: "แนะนำนักเรียนเข้าคลาสเกิน 10 คน",
    icon: "Users",
    color: "text-emerald-500 bg-emerald-500/10",
  },
  CLASS_MASTER: {
    label: "คลาสเตอร์เชี่ยวชาญ",
    description: "จบการสอนแล้วอย่างน้อย 20 คลาส",
    icon: "Trophy",
    color: "text-rose-500 bg-rose-500/10",
  },
  ELITE_EDUCATOR: {
    label: "ยอดปรมาจารย์",
    description: "ผลตอบคำถามของนักเรียนเฉลี่ยเกิน 90%",
    icon: "Target",
    color: "text-indigo-500 bg-indigo-500/10",
  },
  AI_PIONEER: {
    label: "นวัตกรรมแห่งการสอน",
    description: "สร้าง Interactive Session เกิน 10 ครั้ง",
    icon: "Zap",
    color: "text-cyan-500 bg-cyan-500/10",
  },
};

const unavailableMetric = (): MetricValue => ({
  value: null,
  source: "unavailable",
  sampleSize: 0,
});

const clampProgress = (value: number | null, target: number): number => {
  if (value === null || target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
};

const getStudentLevel = (score: number | null): string => {
  if (score === null) return "รอข้อมูลจริง";
  if (score >= 90) return "ดีเยี่ยม";
  if (score >= 75) return "ดีมาก";
  if (score >= 50) return "ผ่านเกณฑ์";
  return "ต้องปรับปรุง";
};

const calculateResponseTimeSamples = (
  messages: Array<{ conversationId: string; senderId: string; createdAt: Date }>,
  tutorUserId: string,
): number[] => {
  const pendingStudentMessageByConversation = new Map<string, Date>();
  const responseTimes: number[] = [];

  for (const message of messages) {
    const pendingStudentMessage = pendingStudentMessageByConversation.get(message.conversationId);

    if (message.senderId === tutorUserId) {
      if (pendingStudentMessage) {
        const diffMinutes = Math.max(
          0,
          Math.round((message.createdAt.getTime() - pendingStudentMessage.getTime()) / 60000),
        );
        responseTimes.push(diffMinutes);
        pendingStudentMessageByConversation.delete(message.conversationId);
      }
      continue;
    }

    if (!pendingStudentMessage) {
      pendingStudentMessageByConversation.set(message.conversationId, message.createdAt);
    }
  }

  return responseTimes;
};

export const getPerformanceSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const allPerformances = await prisma.tutorPerformance.findMany({
      where: { tutorUserId: userId },
      orderBy: { periodMonth: "desc" },
    });
    const latestPerformance = allPerformances[0];

    const [reviewAggregateRows, chatMessages, totalAnswersCount, correctAnswersCount] = await Promise.all([
      prisma.$queryRaw<TutorReviewAggregateRow[]>`
        SELECT AVG("rating")::float AS "average", COUNT("rating")::int AS "total"
        FROM "learning"."tutor_reviews"
        WHERE "tutor_user_id" = CAST(${userId} AS uuid)
      `,
      prisma.message.findMany({
        where: {
          conversation: {
            participants: {
              some: { userId },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        select: {
          conversationId: true,
          senderId: true,
          createdAt: true,
        },
      }),
      prisma.sessionAnswer.count({
        where: {
          session: { tutorUserId: userId },
          isCorrect: { not: null },
        },
      }),
      prisma.sessionAnswer.count({
        where: {
          session: { tutorUserId: userId },
          isCorrect: true,
        },
      }),
    ]);

    const reviewAggregate = reviewAggregateRows[0] || { average: null, total: 0 };
    const reviewCount = Number(reviewAggregate.total);

    const ratingMetric: MetricValue = reviewCount > 0 && reviewAggregate.average != null
      ? {
          value: Number(reviewAggregate.average.toFixed(1)),
          source: "actual",
          sampleSize: reviewCount,
        }
      : latestPerformance?.overallRating != null
        ? {
            value: latestPerformance.overallRating.toNumber(),
            source: "historical",
            sampleSize: 1,
          }
        : unavailableMetric();

    const responseTimeSamples = calculateResponseTimeSamples(chatMessages, userId);
    const responseTimeMetric: MetricValue = responseTimeSamples.length > 0
      ? {
          value: Math.round(
            responseTimeSamples.reduce((sum, sample) => sum + sample, 0) / responseTimeSamples.length,
          ),
          source: "actual",
          sampleSize: responseTimeSamples.length,
        }
      : latestPerformance?.avgResponseTime != null
        ? {
            value: latestPerformance.avgResponseTime,
            source: "historical",
            sampleSize: 1,
          }
        : unavailableMetric();

    let studentBenchmark: StudentBenchmarkMetric;
    if (totalAnswersCount > 0) {
      const studentSuccess = Math.round((correctAnswersCount / totalAnswersCount) * 100);
      studentBenchmark = {
        value: studentSuccess,
        current: studentSuccess,
        target: 80,
        level: getStudentLevel(studentSuccess),
        source: "actual",
        sampleSize: totalAnswersCount,
        correctAnswers: correctAnswersCount,
        totalAnswers: totalAnswersCount,
        details: null,
      };
    } else if (latestPerformance?.studentScoreAvg != null) {
      const historicalStudentSuccess = latestPerformance.studentScoreAvg.toNumber();
      studentBenchmark = {
        value: historicalStudentSuccess,
        current: historicalStudentSuccess,
        target: 80,
        level: getStudentLevel(historicalStudentSuccess),
        source: "historical",
        sampleSize: 1,
        correctAnswers: null,
        totalAnswers: null,
        details: null,
      };
    } else {
      studentBenchmark = {
        value: null,
        current: null,
        target: 80,
        level: getStudentLevel(null),
        source: "unavailable",
        sampleSize: 0,
        correctAnswers: null,
        totalAnswers: null,
        details: null,
      };
    }

    const [completedClasses, totalReferrals, totalInteractiveSessions, badges] = await Promise.all([
      prisma.class.findMany({
        where: { tutorUserId: userId, status: { in: ["CLOSED", "closed"] } },
        include: { book: true },
      }),
      prisma.enrollment.count({
        where: { class: { tutorUserId: userId }, referralToken: { not: null } },
      }),
      prisma.interactiveSession.count({
        where: { tutorUserId: userId },
      }),
      prisma.tutorBadge.findMany({
        where: { tutorUserId: userId },
        orderBy: { unlockedAt: "desc" },
      }),
    ]);

    const totalHours = completedClasses.reduce((sum, cls) => sum + (cls.book?.classHours || 0), 0);
    const completedClassCount = completedClasses.length;
    const unlockedCodes = new Set(badges.map(b => b.badgeCode));

    const unlockedBadgeList = badges.map(b => {
      const def = BADGE_MAP[b.badgeCode] || { label: b.badgeCode, description: "", icon: "Award", color: "text-gray-500 bg-gray-100" };
      return {
        id: b.badgeId,
        unlockedAt: b.unlockedAt.toISOString(),
        ...def,
      };
    });

    let nextGoal = null;

    if (!unlockedCodes.has("RISING_STAR")) {
      nextGoal = {
        code: "RISING_STAR",
        ...BADGE_MAP.RISING_STAR,
        progress: clampProgress(totalHours, 50),
      };
    } else if (!unlockedCodes.has("FAST_RESPONDER")) {
      const responseTime = responseTimeMetric.value;
      const progress = responseTime === null || responseTime <= 0
        ? 0
        : responseTime <= 15
          ? 100
          : Math.max(0, Math.round((15 / responseTime) * 100));
      nextGoal = {
        code: "FAST_RESPONDER",
        ...BADGE_MAP.FAST_RESPONDER,
        progress,
      };
    } else if (!unlockedCodes.has("TOP_RATED")) {
      nextGoal = {
        code: "TOP_RATED",
        ...BADGE_MAP.TOP_RATED,
        progress: clampProgress(ratingMetric.value, 4.8),
      };
    } else if (!unlockedCodes.has("NETWORK_BUILDER")) {
      nextGoal = {
        code: "NETWORK_BUILDER",
        ...BADGE_MAP.NETWORK_BUILDER,
        progress: clampProgress(totalReferrals, 10),
      };
    } else if (!unlockedCodes.has("ELITE_EDUCATOR")) {
      nextGoal = {
        code: "ELITE_EDUCATOR",
        ...BADGE_MAP.ELITE_EDUCATOR,
        progress: clampProgress(studentBenchmark.current, 90),
      };
    } else if (!unlockedCodes.has("CLASS_MASTER")) {
      nextGoal = {
        code: "CLASS_MASTER",
        ...BADGE_MAP.CLASS_MASTER,
        progress: clampProgress(completedClassCount, 20),
      };
    } else if (!unlockedCodes.has("AI_PIONEER")) {
      nextGoal = {
        code: "AI_PIONEER",
        ...BADGE_MAP.AI_PIONEER,
        progress: clampProgress(totalInteractiveSessions, 10),
      };
    }

    res.status(200).json({
      metrics: {
        studentBenchmark,
        engagement: {
          responseTimeMinutes: responseTimeMetric,
          rating: ratingMetric,
          completedClasses: completedClassCount,
        },
        activity: {
          completedClasses: completedClassCount,
          completedHours: totalHours,
          interactiveSessions: totalInteractiveSessions,
          referralCount: totalReferrals,
          reviews: {
            total: reviewCount,
            average: reviewAggregate.average,
          },
          answers: {
            total: totalAnswersCount,
            correct: correctAnswersCount,
          },
        },
      },
      badges: {
        unlocked: unlockedBadgeList,
        nextGoal,
      },
    });
  } catch (error) {
    console.error("Failed to fetch performance summary", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
