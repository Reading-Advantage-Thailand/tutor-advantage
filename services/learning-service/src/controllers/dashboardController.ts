import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { lessonSessionService } from "../services/LessonSessionService";

export async function getDashboardSummary(
  req: AuthenticatedRequest,
  res: Response,
) {
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
      const enrollments = await prisma.enrollment.findMany({
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

      const tutorIds = enrollments.map((e: any) => e.class.tutorUserId).filter(Boolean);
      const tutors = await prisma.user.findMany({
        where: { userId: { in: tutorIds } },
        select: { userId: true, displayName: true }
      });
      const tutorMap = new Map(tutors.map((t: any) => [t.userId, t.displayName]));

      // 2. Calculate read articles
      const readParticipations = await prisma.sessionParticipant.findMany({
        where: {
          studentUserId: userId,
          session: { status: "FINISHED" }
        },
        include: {
          session: { select: { articleId: true, createdAt: true } as any }
        }
      });

      const distinctArticlesRead = new Set(readParticipations.map((p: any) => p.session.articleId));
      
      // 3. Calculate consecutive week streak (counting backwards from current week)
      const today = new Date();
      const getWeekId = (d: Date) => {
        const copy = new Date(d);
        copy.setHours(0,0,0,0);
        const firstJan = new Date(copy.getFullYear(), 0, 1);
        return `${copy.getFullYear()}-W${Math.ceil((((copy.getTime() - firstJan.getTime()) / 86400000) + firstJan.getDay() + 1) / 7)}`;
      };

      const activeWeeks = new Set(readParticipations.map((p: any) => getWeekId(new Date(p.joinedAt || (p as any).session?.createdAt))));
      
      let streak = 0;
      let checkDate = new Date(today);
      while (true) {
        const weekId = getWeekId(checkDate);
        if (activeWeeks.has(weekId)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 7); // Move back 1 week
        } else {
          break;
        }
      }

      const recentClasses = await Promise.all(enrollments.slice(0, 3).map(async (e: any) => {
        const session = lessonSessionService.getSessionByClassId(e.class.classId);
        const tutorName = tutorMap.get(e.class.tutorUserId) || "Tutor";
        
        // Calculate actual class progress based on current book articles read
        const bookArticles = await prisma.article.findMany({
          where: { bookId: e.class.bookId },
          select: { articleId: true }
        });
        
        const bookArticleIds = bookArticles.map(a => a.articleId);
        const articlesCompletedInClass = bookArticleIds.filter(id => distinctArticlesRead.has(id)).length;
        const totalArticlesInBook = bookArticles.length || 10; // Fallback if articles missing
        const actualProgress = Math.round((articlesCompletedInClass / totalArticlesInBook) * 100);

        return {
          id: e.class.classId,
          name: e.class.title || e.class.book?.title || "Untitled Class",
          status: e.class.status.toLowerCase(),
          tutorName,
          nextSession: e.class.scheduleDescription || "ตามนัดหมาย",
          progress: actualProgress,
          isLive: !!session,
          bookName: e.class.book?.title,
          seriesCefr: e.class.book?.series?.cefrLevel || "A1",
        };
      }));

      // 4. Calculate total unread messages
      const conversationParticipants = await prisma.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true, lastReadAt: true }
      });

      let totalUnreadMessages = 0;
      for (const cp of conversationParticipants) {
        const unread = await prisma.message.count({
          where: {
            conversationId: cp.conversationId,
            senderId: { not: userId },
            ...(cp.lastReadAt ? { createdAt: { gt: cp.lastReadAt } } : {})
          }
        });
        totalUnreadMessages += unread;
      }

      return res.status(200).json({
        activeEnrollments: enrollments.length,
        totalArticlesRead: distinctArticlesRead.size,
        weekStreak: streak,
        recentClasses,
        unreadMessages: totalUnreadMessages,
      });
    }

    // 1. Fetch all classes owned by the tutor (Existing logic for TUTOR)
    const classes = await prisma.class.findMany({
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
      nextSession: "ตามนัดหมาย", // Mock static text for now
    }));

    // Calculate total unread messages for tutor
    const conversationParticipants = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true, lastReadAt: true }
    });

    let unreadMessages = 0;
    for (const cp of conversationParticipants) {
      const unread = await prisma.message.count({
        where: {
          conversationId: cp.conversationId,
          senderId: { not: userId },
          ...(cp.lastReadAt ? { createdAt: { gt: cp.lastReadAt } } : {})
        }
      });
      unreadMessages += unread;
    }

    const classesThisWeek = classes.length > 0 ? Math.min(classes.length, 5) : 0;

    return res.status(200).json({
      openClasses: openClassesCount,
      totalStudents,
      classesThisWeek,
      recentClasses,
      unreadMessages,
    });
  } catch (error: any) {
    console.error("Dashboard Summary Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: error.message },
    });
  }
}
export async function getStudentProgress(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 1. Find main enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentUserId: userId, status: "ACTIVE" },
      include: {
        class: {
          include: {
            book: { include: { series: true } },
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }) as any;

    if (!enrollment) {
      return res.status(200).json({
        stats: { articlesRead: 0, totalArticles: 0, totalMinutes: 0, weekStreak: 0, level: "N/A", cefr: "N/A", seriesColor: "#06c755" },
        weeklyActivity: [],
        articles: []
      });
    }

    const book = enrollment.class.book;

    // 2. Get total read articles count and full history for weekly logic
    const participations = await prisma.sessionParticipant.findMany({
      where: { studentUserId: userId, session: { status: "FINISHED" } },
      include: { session: true }
    }) as any[];

    const distinctArticlesRead = new Set(participations.map(p => p.session.articleId));
    const totalMinutes = participations.length * 25; // Estimate 25 min per read session

    // 3. Get Book Articles
    const dbArticles = await prisma.article.findMany({
      where: { bookId: book.bookId },
      orderBy: { articleId: 'asc' }
    });

    const articles = dbArticles.map((art, idx) => {
      const isRead = distinctArticlesRead.has(art.articleId);
      return {
        id: art.articleId,
        no: idx + 1,
        title: art.title || "Untitled",
        done: isRead,
        minutes: isRead ? 25 : 0 // Mock 25 mins for finished articles
      };
    });

    // 4. Weekly Activity & Streak
    const now = new Date();
    const currentDay = now.getDay(); 
    const diffToMon = (currentDay === 0 ? -6 : 1) - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0,0,0,0);

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
        .length * 25;
      
      return {
        day: label,
        minutes: minsForDay,
        active: minsForDay > 0
      };
    });

    // True consecutive streak logic
    const getWeekId = (d: Date) => {
      const copy = new Date(d);
      copy.setHours(0,0,0,0);
      const firstJan = new Date(copy.getFullYear(), 0, 1);
      return `${copy.getFullYear()}-W${Math.ceil((((copy.getTime() - firstJan.getTime()) / 86400000) + firstJan.getDay() + 1) / 7)}`;
    };

    const activeWeeks = new Set(participations.map((p: any) => getWeekId(new Date(p.joinedAt || p.session?.createdAt))));
    
    let streak = 0;
    let checkDate = new Date(now);
    while (true) {
      const weekId = getWeekId(checkDate);
      if (activeWeeks.has(weekId)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 7); 
      } else {
        break;
      }
    }

    return res.status(200).json({
      stats: {
        articlesRead: articles.filter(a => a.done).length,
        totalArticles: dbArticles.length || book.articleCount || 10,
        weekStreak: streak,
        totalMinutes,
        level: book.title || "Origins",
        cefr: book.series?.cefrLevel || "A1",
        seriesColor: "#06c755",
        nextMilestone: {
          label: `บทที่ ${articles.length}`,
          at: articles.length,
          reward: "Graduate"
        }
      },
      weeklyActivity,
      articles
    });

  } catch (error: any) {
    console.error("Get Student Progress Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not fetch progress" },
    });
  }
}
