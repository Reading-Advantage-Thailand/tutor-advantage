import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { getArticleDetails } from "../services/ReadingAdvantageDB";

export async function getStudentLessonHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 1. Fetch all session participations for this user
    const participations = await prisma.sessionParticipant.findMany({
      where: { studentUserId: userId },
      include: {
        session: {
          include: {
            tutor: { select: { displayName: true } },
            // include other participants count for ranking info
            participants: { select: { studentUserId: true, score: true } }
          }
        }
      },
      orderBy: { joinedAt: "desc" },
      take: 20 // Limit to recent 20
    });

    // 2. Map data and calculate ranking + resolve article details
    const history = await Promise.all(participations.map(async (p) => {
      const session = p.session;
      
      // Fetch article info from RA db/mock
      const articleInfo = await getArticleDetails(session.articleId).catch(() => null);

      // Calculate rank dynamically
      const sortedPeers = session.participants.sort((a, b) => (b.score || 0) - (a.score || 0));
      const myRank = sortedPeers.findIndex(peer => peer.studentUserId === userId) + 1;

      return {
        sessionId: session.sessionId,
        articleId: session.articleId,
        articleTitle: articleInfo?.title || "บทเรียนไร้ชื่อ",
        articleLevel: articleInfo?.cefr_level || "N/A",
        tutorName: session.tutor.displayName || "Tutor",
        score: p.score,
        rank: myRank,
        totalParticipants: sortedPeers.length,
        date: p.joinedAt,
        status: session.status
      };
    }));

    return res.status(200).json({ history });
  } catch (error: any) {
    console.error("Fetch Lesson History Error:", error);
    return res.status(500).json({ error: "Internal server error fetching history" });
  }
}

export async function getLessonSessionDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch session data including user's specific answers
    const participant = await prisma.sessionParticipant.findUnique({
      where: { sessionId_studentUserId: { sessionId, studentUserId: userId } },
      include: {
        session: {
          include: {
            tutor: { select: { displayName: true } }
          }
        }
      }
    });

    if (!participant) {
      return res.status(404).json({ error: "ประวัติเซสชันนี้ไม่พบหรือไม่มีสิทธิ์เข้าถึง" });
    }

    const answers = await prisma.sessionAnswer.findMany({
      where: { sessionId, studentUserId: userId },
      orderBy: { phase: "asc" }
    });

    const articleInfo = await getArticleDetails(participant.session.articleId).catch(() => null);

    return res.status(200).json({
      session: {
        sessionId: participant.session.sessionId,
        articleTitle: articleInfo?.title,
        tutorName: participant.session.tutor.displayName,
        date: participant.joinedAt,
        totalScore: participant.score,
      },
      answers: answers.map(a => ({
        phase: a.phase,
        question: a.questionText || `คำถามข้อที่ ${a.phase}`,
        answer: a.answerText,
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect,
        score: a.score,
        aiFeedback: a.aiFeedback
      }))
    });

  } catch (error) {
    console.error("Fetch Session Detail Error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}
