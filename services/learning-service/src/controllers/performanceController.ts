import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

const prisma = new PrismaClient();

const BADGE_MAP: Record<string, { label: string, description: string, icon: string, color: string }> = {
  "RISING_STAR": {
    label: "ชั่วโมงสอนทะลุเป้า",
    description: "สอนครบ 50 ชั่วโมง",
    icon: "Star",
    color: "text-amber-500 bg-amber-500/10",
  },
  "FAST_RESPONDER": {
    label: "ตอบแชทไว",
    description: "ตอบกลับนักเรียนเฉลี่ยไม่เกิน 15 นาที",
    icon: "Zap",
    color: "text-blue-500 bg-blue-500/10",
  },
  "TOP_RATED": {
    label: "ขวัญใจนักเรียน",
    description: "เรตติ้งเฉลี่ยสูงกว่า 4.8",
    icon: "Award",
    color: "text-violet-500 bg-violet-500/10",
  },
  "NETWORK_BUILDER": {
    label: "นักสร้างทีม",
    description: "แนะนำนักเรียนเข้าคลาสเกิน 10 คน",
    icon: "Users",
    color: "text-emerald-500 bg-emerald-500/10",
  },
  "CLASS_MASTER": {
    label: "คลาสเตอร์เชี่ยวชาญ",
    description: "จบการสอนแล้วอย่างน้อย 20 คลาส",
    icon: "Trophy",
    color: "text-rose-500 bg-rose-500/10",
  },
  "ELITE_EDUCATOR": {
    label: "ยอดปรมาจารย์",
    description: "ผลประเมินรวมนักเรียนเฉลี่ยเกิน 90%",
    icon: "Target",
    color: "text-indigo-500 bg-indigo-500/10",
  },
  "AI_PIONEER": {
    label: "นวัตกรรมแห่งการสอน",
    description: "สร้าง Interactive Session เกิน 10 ครั้ง",
    icon: "Zap",
    color: "text-cyan-500 bg-cyan-500/10",
  }
};

export const getPerformanceSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Get ALL performances for actual historical averages (for static metrics like overallRating)
    const allPerformances = await prisma.tutorPerformance.findMany({
      where: { tutorUserId: userId },
      orderBy: { periodMonth: 'desc' }
    });

    let activeStudentsScore = 0;
    let responseTime = 0;
    let avgRating = 0;

    if (allPerformances.length > 0) {
      const latest = allPerformances[0];
      responseTime = latest.avgResponseTime || 15; // Default reasonable response
      avgRating = latest.overallRating ? latest.overallRating.toNumber() : 4.5; // Default reasonable rating
    } else {
      responseTime = 15;
      avgRating = 4.8; // Default starting rating for new tutors
    }

    // 1b. DYNAMICALLY calculate actual real-time aggregate student performance from real session interactions!
    const totalAnswersCount = await prisma.sessionAnswer.count({
      where: { session: { tutorUserId: userId } }
    });

    if (totalAnswersCount > 0) {
      const correctAnswersCount = await prisma.sessionAnswer.count({
        where: { 
          session: { tutorUserId: userId },
          isCorrect: true
        }
      });
      activeStudentsScore = Math.round((correctAnswersCount / totalAnswersCount) * 100);
      console.log(`[PerformanceAPI] Dynamically calculated student score avg for tutor ${userId}: ${activeStudentsScore}% (${correctAnswersCount}/${totalAnswersCount})`);
    } else {
      // Fallback to historical table if they haven't had dynamic sessions recently but have historical record
      if (allPerformances.length > 0 && allPerformances[0].studentScoreAvg) {
        activeStudentsScore = allPerformances[0].studentScoreAvg.toNumber();
      }
    }

    // 2. Count actual completed classes and hours
    const completedClasses = await prisma.class.findMany({
      where: { tutorUserId: userId, status: "closed" },
      include: { book: true }
    });

    const totalHours = completedClasses.reduce((sum, cls) => sum + (cls.book?.classHours || 0), 0);
    const completedClassCount = completedClasses.length;

    // 3. Count total referrals for network builder substitution
    const totalReferrals = await prisma.enrollment.count({
      where: { class: { tutorUserId: userId }, referralToken: { not: null } }
    });

    // 3b. Count total sessions created for AI_PIONEER
    const totalInteractiveSessions = await prisma.interactiveSession.count({
      where: { tutorUserId: userId }
    });

    // 4. Fetch Unlocked Badges
    const badges = await prisma.tutorBadge.findMany({
      where: { tutorUserId: userId },
      orderBy: { unlockedAt: "desc" }
    });
    const unlockedCodes = new Set(badges.map(b => b.badgeCode));

    const unlockedBadgeList = badges.map(b => {
      const def = BADGE_MAP[b.badgeCode] || { label: b.badgeCode, description: "", icon: "Award", color: "text-gray-500 bg-gray-100" };
      return {
        id: b.badgeId,
        unlockedAt: b.unlockedAt.toISOString(),
        ...def
      };
    });

    // 5. Determine Next Goal intelligently based on extended ecosystem progress sequence
    let nextGoal = null;

    if (!unlockedCodes.has("RISING_STAR")) {
      nextGoal = {
        code: "RISING_STAR",
        ...BADGE_MAP["RISING_STAR"],
        progress: Math.min(100, Math.round((totalHours / 50) * 100))
      };
    } else if (!unlockedCodes.has("FAST_RESPONDER")) {
      let progress = 100;
      if (responseTime > 15) {
        progress = Math.max(0, Math.round((15 / responseTime) * 100));
      } else if (responseTime === 0) {
        progress = 0;
      }
      nextGoal = {
        code: "FAST_RESPONDER",
        ...BADGE_MAP["FAST_RESPONDER"],
        progress
      };
    } else if (!unlockedCodes.has("TOP_RATED")) {
       nextGoal = {
        code: "TOP_RATED",
        ...BADGE_MAP["TOP_RATED"],
        progress: Math.min(100, Math.round((avgRating / 4.8) * 100))
      };
    } else if (!unlockedCodes.has("NETWORK_BUILDER")) {
      nextGoal = {
        code: "NETWORK_BUILDER",
        ...BADGE_MAP["NETWORK_BUILDER"],
        progress: Math.min(100, Math.round((totalReferrals / 10) * 100))
      };
    } else if (!unlockedCodes.has("ELITE_EDUCATOR")) {
      nextGoal = {
        code: "ELITE_EDUCATOR",
        ...BADGE_MAP["ELITE_EDUCATOR"],
        progress: Math.min(100, Math.round((activeStudentsScore / 90) * 100))
      };
    } else if (!unlockedCodes.has("CLASS_MASTER")) {
      nextGoal = {
        code: "CLASS_MASTER",
        ...BADGE_MAP["CLASS_MASTER"],
        progress: Math.min(100, Math.round((completedClassCount / 20) * 100))
      };
    } else if (!unlockedCodes.has("AI_PIONEER")) {
      nextGoal = {
        code: "AI_PIONEER",
        ...BADGE_MAP["AI_PIONEER"],
        progress: Math.min(100, Math.round((totalInteractiveSessions / 10) * 100))
      };
    }

    // Determine level string
    let levelStr = "รอประเมิน";
    if (activeStudentsScore >= 90) levelStr = "ดีเยี่ยม";
    else if (activeStudentsScore >= 75) levelStr = "ดีมาก";
    else if (activeStudentsScore >= 50) levelStr = "ผ่านเกณฑ์";
    else if (activeStudentsScore > 0) levelStr = "ต้องปรับปรุง";

    res.status(200).json({
      metrics: {
        studentBenchmark: {
          current: activeStudentsScore,
          target: 80, // Target minimum 80% passing
          level: levelStr,
          details: null
        },
        engagement: {
          responseTimeMinutes: responseTime,
          rating: avgRating,
          completedClasses: completedClassCount,
        }
      },
      badges: {
        unlocked: unlockedBadgeList,
        nextGoal
      }
    });

  } catch (error) {
    console.error("Failed to fetch performance summary", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
