import { logger } from "@tutor-advantage/shared-config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Badge bonus amounts in Satang (1 THB = 100 Satang).
 * These are added to the tutor's monthly payout in addition to MLM commissions.
 * Values must be confirmed by Product before production deployment.
 */
export const BADGE_BONUS_SATANG: Record<string, bigint> = {
  ELITE_EDUCATOR: 50000n,  // +500 THB/month — highest student success rate
  TOP_RATED:      30000n,  // +300 THB/month — consistently high ratings
  CLASS_MASTER:   20000n,  // +200 THB/month — completed 20+ classes
  NETWORK_BUILDER: 10000n, // +100 THB/month — 10+ referrals
  RISING_STAR:     5000n,  // +50 THB/month  — 50+ teaching hours
  FAST_RESPONDER:  5000n,  // +50 THB/month  — avg response ≤ 15 min
  AI_PIONEER:      5000n,  // +50 THB/month  — 10+ interactive sessions
};

interface TutorMetrics {
  totalHours: number;
  avgResponseMinutes: number | null;
  ratingAvg: number | null;
  totalReferrals: number;
  completedClasses: number;
  studentSuccessRate: number | null; // 0.0–1.0
  interactiveSessions: number;
}

/**
 * Fetches current performance metrics for a tutor.
 * Mirrors the calculation logic in performanceController.ts.
 */
async function fetchTutorMetrics(tutorUserId: string): Promise<TutorMetrics> {
  const [
    completedClasses,
    scheduledClasses,
    totalReferrals,
    totalInteractiveSessions,
    totalAnswers,
    correctAnswers,
    chatMessages,
    reviewAggregate,
  ] = await Promise.all([
    prisma.class.findMany({
      where: { tutorUserId, status: { in: ["CLOSED", "closed"] } },
      select: { classId: true },
    }),
    // Teaching hours from actual scheduled time (start→end) across all classes,
    // mirroring performanceController.ts.
    prisma.class.findMany({
      where: { tutorUserId, startsAt: { not: null }, endsAt: { not: null } },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.enrollment.count({
      where: { class: { tutorUserId }, referralToken: { not: null } },
    }),
    prisma.interactiveSession.count({ where: { tutorUserId } }),
    prisma.sessionAnswer.count({
      where: { session: { tutorUserId }, isCorrect: { not: null } },
    }),
    prisma.sessionAnswer.count({
      where: { session: { tutorUserId }, isCorrect: true },
    }),
    prisma.message.findMany({
      where: { conversation: { participants: { some: { userId: tutorUserId } } } },
      orderBy: { createdAt: "asc" },
      select: { conversationId: true, senderId: true, createdAt: true },
    }),
    prisma.$queryRaw<[{ average: number | null }]>`
      SELECT AVG("rating")::float AS "average"
      FROM "learning"."tutor_reviews"
      WHERE "tutor_user_id" = CAST(${tutorUserId} AS uuid)
    `,
  ]);

  const totalHours = Math.round(
    scheduledClasses.reduce((sum, cls) => {
      const durationMs = cls.endsAt!.getTime() - cls.startsAt!.getTime();
      return durationMs > 0 ? sum + durationMs / 3_600_000 : sum;
    }, 0),
  );

  // Compute avg response time from chat messages
  const pendingByConversation = new Map<string, Date>();
  const responseTimes: number[] = [];
  for (const msg of chatMessages) {
    if (msg.senderId === tutorUserId) {
      const pending = pendingByConversation.get(msg.conversationId);
      if (pending) {
        responseTimes.push(
          Math.max(0, Math.round((msg.createdAt.getTime() - pending.getTime()) / 60000)),
        );
        pendingByConversation.delete(msg.conversationId);
      }
    } else if (!pendingByConversation.has(msg.conversationId)) {
      pendingByConversation.set(msg.conversationId, msg.createdAt);
    }
  }
  const avgResponseMinutes =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

  const ratingAvg = reviewAggregate[0]?.average ?? null;
  const studentSuccessRate =
    totalAnswers > 0 ? correctAnswers / totalAnswers : null;

  return {
    totalHours,
    avgResponseMinutes,
    ratingAvg,
    totalReferrals,
    completedClasses: completedClasses.length,
    studentSuccessRate,
    interactiveSessions: totalInteractiveSessions,
  };
}

/**
 * Checks each badge threshold and upserts TutorBadge records for newly earned badges.
 * Safe to call multiple times — skips already-unlocked badges.
 */
export async function checkAndUnlockBadges(tutorUserId: string): Promise<string[]> {
  try {
    const [metrics, existingBadges] = await Promise.all([
      fetchTutorMetrics(tutorUserId),
      prisma.tutorBadge.findMany({
        where: { tutorUserId },
        select: { badgeCode: true },
      }),
    ]);

    const alreadyUnlocked = new Set(existingBadges.map((b) => b.badgeCode));

    const toUnlock: string[] = [];

    if (!alreadyUnlocked.has("RISING_STAR") && metrics.totalHours >= 50) {
      toUnlock.push("RISING_STAR");
    }
    if (
      !alreadyUnlocked.has("FAST_RESPONDER") &&
      metrics.avgResponseMinutes !== null &&
      metrics.avgResponseMinutes <= 15
    ) {
      toUnlock.push("FAST_RESPONDER");
    }
    if (
      !alreadyUnlocked.has("TOP_RATED") &&
      metrics.ratingAvg !== null &&
      metrics.ratingAvg >= 4.8
    ) {
      toUnlock.push("TOP_RATED");
    }
    if (!alreadyUnlocked.has("NETWORK_BUILDER") && metrics.totalReferrals >= 10) {
      toUnlock.push("NETWORK_BUILDER");
    }
    if (!alreadyUnlocked.has("CLASS_MASTER") && metrics.completedClasses >= 20) {
      toUnlock.push("CLASS_MASTER");
    }
    if (
      !alreadyUnlocked.has("ELITE_EDUCATOR") &&
      metrics.studentSuccessRate !== null &&
      metrics.studentSuccessRate >= 0.9
    ) {
      toUnlock.push("ELITE_EDUCATOR");
    }
    if (!alreadyUnlocked.has("AI_PIONEER") && metrics.interactiveSessions >= 10) {
      toUnlock.push("AI_PIONEER");
    }

    if (toUnlock.length === 0) return [];

    // Upsert all newly earned badges in one transaction
    await prisma.$transaction(
      toUnlock.map((badgeCode) =>
        prisma.tutorBadge.upsert({
          where: { tutorUserId_badgeCode: { tutorUserId, badgeCode } },
          create: { tutorUserId, badgeCode },
          update: {}, // already exists — no-op
        }),
      ),
    );

    logger.info(`[BadgeService] Unlocked badges for ${tutorUserId}: ${toUnlock.join(", ")}`);
    return toUnlock;
  } catch (error) {
    // Non-fatal: badge unlock failure should not block the caller
    logger.error(`[BadgeService] Failed to check badges for ${tutorUserId}:`, error);
    return [];
  }
}

/**
 * Returns the total badge bonus in Satang for a tutor's current badges.
 * Used by SettlementService to add bonus to payout lines.
 */
export async function getTutorBadgeBonusSatang(tutorUserId: string): Promise<bigint> {
  const badges = await prisma.tutorBadge.findMany({
    where: { tutorUserId },
    select: { badgeCode: true },
  });

  return badges.reduce((sum, b) => {
    return sum + (BADGE_BONUS_SATANG[b.badgeCode] ?? 0n);
  }, 0n);
}
