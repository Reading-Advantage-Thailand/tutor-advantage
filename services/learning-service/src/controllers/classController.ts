import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { getArticleDetails } from "../services/ReadingAdvantageDB";
import { log } from "console";

export async function createClass(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { bookId, title, capacity, scheduleDescription } = req.body;

    if (!userId || role !== "TUTOR") {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED_ROLE",
          message: "Only tutors can create classes",
          requestId: req.id,
        },
      });
    }

    if (!bookId || !title || typeof capacity !== "number") {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "bookId, title, and capacity are required",
          requestId: req.id,
        },
      });
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        bookId,
      );
    let book = await prisma.book.findFirst({
      where: isUuid ? { bookId: bookId } : { bookCode: bookId },
    });

    if (!book && !isUuid) {
      // Create a mock book since it crosses from another app but doesn't exist here yet
      let mockSeries = await prisma.series.findFirst({
        where: { code: "MOCK-X" },
      });
      if (!mockSeries) {
        mockSeries = await prisma.series.create({
          data: {
            code: "MOCK-X",
            name: "Mock Series (Cross App)",
            cefrLevel: "A1",
            raLevelStart: 1,
            raLevelEnd: 6,
          },
        });
      }
      book = await prisma.book.create({
        data: {
          bookCode: bookId,
          title: `Book: ${bookId}`,
          levelNumber: 1,
          seriesId: mockSeries.seriesId,
          articleCount: 10,
          classHours: 10,
        },
      });
    }

    if (!book) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Book not found",
          requestId: req.id,
        },
      });
    }

    const newClass = await prisma.class.create({
      data: {
        tutorUserId: userId,
        bookId: book.bookId,
        title,
        capacity,
        scheduleDescription,
        meetingUrl: req.body.meetingUrl,
        status: "OPEN",
      },
    });

    return res.status(201).json({
      message: "Class created successfully",
      class: newClass,
    });
  } catch (error: any) {
    console.error("Create Class Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not create class",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

export async function closeClass(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { classId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
          requestId: req.id,
        },
      });
    }

    const existingClass = await prisma.class.findUnique({
      where: { classId },
    });

    if (!existingClass) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Class not found",
          requestId: req.id,
        },
      });
    }

    if (existingClass.tutorUserId !== userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only close your own classes",
          requestId: req.id,
        },
      });
    }

    const updatedClass = await prisma.class.update({
      where: { classId },
      data: { status: "CLOSED" },
    });

    return res.status(200).json({
      message: "Class closed successfully",
      class: updatedClass,
    });
  } catch (error: any) {
    console.error("Close Class Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not close class",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

export async function getClasses(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User ID missing" },
      });
    }

    const role = req.user?.role;
    let classes;

    if (role === "TUTOR") {
      classes = await prisma.class.findMany({
        where: { tutorUserId: userId },
        include: { book: true, _count: { select: { enrollments: true } } },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Student: Fetch enrolled classes
      const enrollments = await prisma.enrollment.findMany({
        where: { studentUserId: userId },
        include: {
          class: {
            include: { book: true, _count: { select: { enrollments: true } } },
          },
        } as any,
        orderBy: { createdAt: "desc" },
      });
      classes = enrollments.map((e: any) => e.class);
    }

    // Fetch tutors for these classes
    const tutorIds = [...new Set(classes.map((c) => c.tutorUserId))];
    const tutors = await prisma.user.findMany({
      where: { userId: { in: tutorIds } },
      select: { userId: true, displayName: true },
    });
    const tutorMap = new Map(tutors.map((t) => [t.userId, t.displayName]));

    const mappedClasses = classes.map((c) => ({
      id: c.classId,
      name: c.title || (c as any).book?.title || "Untitled Class",
      book: (c as any).book?.title || "Unknown Book",
      status: c.status.toLowerCase(),
      students: (c as any)._count?.enrollments || 0,
      maxStudents: c.capacity,
      tutorName: tutorMap.get(c.tutorUserId) || "Unknown Tutor",
      nextSession: c.scheduleDescription || "ยังไม่ได้กำหนด",
    }));

    return res.status(200).json({ classes: mappedClasses });
  } catch (error: any) {
    console.error("Get Classes Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch classes",
      },
    });
  }
}

export async function getClassById(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { classId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User ID missing" },
      });
    }

    const cls = (await prisma.class.findUnique({
      where: { classId },
      include: { book: true, enrollments: true } as any,
    })) as any;

    if (!cls) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Class not found" },
      });
    }

    // Fetch tutor manually
    const tutor = await prisma.user.findUnique({
      where: { userId: cls.tutorUserId },
      select: { displayName: true },
    });

    const role = req.user?.role;
    const isEnrolled = cls.enrollments?.some(
      (e: any) => e.studentUserId === userId,
    );

    if (cls.tutorUserId !== userId && !isEnrolled && role !== "ADMIN") {
      // If student is not enrolled, they can still view if the class is OPEN (for preview)
      if (cls.status !== "OPEN") {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You don't have access to this class",
          },
        });
      }
    }

    // Fetch user details for the students
    const studentIds = cls.enrollments?.map((e: any) => e.studentUserId) || [];
    const users = await prisma.user.findMany({
      where: { userId: { in: studentIds } },
      select: { userId: true, displayName: true, profilePictureUrl: true },
    });

    const userMap = new Map();
    users.forEach((u: any) => userMap.set(u.userId, { name: u.displayName, avatar: u.profilePictureUrl }));

    const mapped = {
      id: cls.classId,
      name: cls.title || cls.book?.title || "Untitled Class",
      book: cls.book?.title || "Unknown Book",
      status: cls.status.toLowerCase(),
      students: cls.enrollments?.length || 0,
      maxStudents: cls.capacity,
      schedule: cls.scheduleDescription || "ยังไม่ได้กำหนด",
      meetingUrl:
        cls.tutorUserId === userId || isEnrolled ? cls.meetingUrl || "" : "",
      tutor: {
        name: tutor?.displayName || "Unknown Tutor",
        initials: tutor?.displayName?.substring(0, 2) || "TA",
      },
      articleId: cls.book?.bookCode
        ? (await prisma.article.findFirst({ where: { bookId: cls.bookId } }))
            ?.articleId
        : "article-default-123",
      referralLink: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/enroll?classId=${cls.classId}`,
      isEnrolled: isEnrolled, // Added this field
      enrolledStudents:
        cls.tutorUserId === userId
          ? cls.enrollments?.map((e: any) => ({
              name: userMap.get(e.studentUserId)?.name || "Unknown Student",
              avatarUrl: userMap.get(e.studentUserId)?.avatar || null,
              enrolled: e.createdAt.toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }),
              paid: e.status === "ACTIVE",
            }))
          : [],
    };

    return res.status(200).json({ class: mapped });
  } catch (error: any) {
    console.error("Get Class By ID Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch class",
      },
    });
  }
}

export async function getAvailableClasses(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const classes = await prisma.class.findMany({
      where: { status: "OPEN" },
      include: {
        book: true,
        _count: { select: { enrollments: true } },
      } as any,
      orderBy: { createdAt: "desc" },
    });

    // Fetch tutors manually
    const tutorIds = [...new Set(classes.map((c) => c.tutorUserId))];
    const tutors = await prisma.user.findMany({
      where: { userId: { in: tutorIds } },
      select: { userId: true, displayName: true },
    });
    const tutorMap = new Map(tutors.map((t) => [t.userId, t.displayName]));

    const mappedClasses = classes.map((c) => {
      const tutorName = tutorMap.get(c.tutorUserId) || "Unknown Tutor";
      return {
        id: c.classId,
        name: c.title || (c as any).book?.title || "Untitled Class",
        tutor: tutorName,
        tutorInitials: tutorName.substring(0, 2),
        book: (c as any).book?.title || "Unknown Book",
        status: "open",
        enrolled: (c as any)._count?.enrollments || 0,
        capacity: c.capacity,
        price: 2800, // Placeholder price
        nextSession: c.scheduleDescription || "TBA",
      };
    });

    return res.status(200).json({ classes: mappedClasses });
  } catch (error: any) {
    console.error("Get Available Classes Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch available classes",
      },
    });
  }
}

export async function getBooks(req: AuthenticatedRequest, res: Response) {
  try {
    const books = await prisma.book.findMany({
      include: { series: true },
      orderBy: [
        { series: { raLevelStart: "asc" } },
        { levelNumber: "asc" },
        { bookCode: "asc" },
      ],
    });

    return res.status(200).json({ books });
  } catch (error: any) {
    console.error("Get Books Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch books",
      },
    });
  }
}
export async function deleteClass(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { classId } = req.params;

    if (!userId) {
      return res
        .status(401)
        .json({ error: { code: "UNAUTHORIZED", message: "User ID missing" } });
    }

    const cls = await prisma.class.findUnique({
      where: { classId },
      include: {
        enrollments: true,
        conversations: true,
      },
    });

    if (!cls || cls.tutorUserId !== userId) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Class not found" } });
    }

    const enrollmentIds = cls.enrollments.map((e) => e.enrollmentId);
    const conversationIds = cls.conversations.map((c) => c.conversationId);

    console.log(`[DELETE_CLASS] Starting deletion for class: ${classId}`);

    // Break down into smaller steps for better error visibility
    try {
      if (enrollmentIds.length > 0) {
        console.log(
          `[DELETE_CLASS] Step 1: Cleaning up Finance records for ${enrollmentIds.length} enrollments...`,
        );
        // PaymentEvents reference PaymentIntents
        const eventsDeleted = await prisma.paymentEvent.deleteMany({
          where: { paymentIntent: { enrollmentId: { in: enrollmentIds } } },
        });
        console.log(
          `[DELETE_CLASS] Deleted ${eventsDeleted.count} payment events`,
        );

        // PaymentIntents reference Enrollments
        const intentsDeleted = await prisma.paymentIntent.deleteMany({
          where: { enrollmentId: { in: enrollmentIds } },
        });
        console.log(
          `[DELETE_CLASS] Deleted ${intentsDeleted.count} payment intents`,
        );
      }

      console.log(`[DELETE_CLASS] Step 2: Cleaning up Chat records...`);
      if (conversationIds.length > 0) {
        await prisma.message.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });
        await prisma.conversationParticipant.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });
        await prisma.conversation.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });
      }

      console.log(`[DELETE_CLASS] Step 3: Cleaning up Learning relations...`);
      await prisma.enrollment.deleteMany({ where: { classId } });
      await prisma.referral.deleteMany({ where: { classId } });
      await prisma.classTransferRequest.deleteMany({ where: { classId } });

      console.log(`[DELETE_CLASS] Step 4: Deleting the Class record itself...`);
      await prisma.class.delete({
        where: { classId },
      });

      console.log(`[DELETE_CLASS] ✅ Successfully deleted class ${classId}`);
      return res.status(200).json({ message: "Class deleted successfully" });
    } catch (stepError: any) {
      console.error("[DELETE_CLASS] Step Error:", stepError);
      throw stepError; // Re-throw to be caught by main catch
    }
  } catch (error: any) {
    console.error("[DELETE_CLASS] ❌ FINAL ERROR:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not delete class",
        details: error.message,
        prismaCode: error.code,
      },
    });
  }
}
export async function updateMeetingUrl(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { classId } = req.params;
    const { meetingUrl } = req.body;

    if (!userId) {
      return res
        .status(401)
        .json({ error: { code: "UNAUTHORIZED", message: "User ID missing" } });
    }

    const cls = await prisma.class.findUnique({ where: { classId } });
    if (!cls || cls.tutorUserId !== userId) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Class not found or unauthorized",
        },
      });
    }

    const updated = await prisma.class.update({
      where: { classId },
      data: { meetingUrl },
    });

    return res
      .status(200)
      .json({ message: "Meeting URL updated", meetingUrl: updated.meetingUrl });
  } catch (error: any) {
    console.error("Update Meeting URL error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Update failed" },
    });
  }
}

async function translateToThai(text: string): Promise<string> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=th&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const json = await res.json() as any;
    return json?.[0]?.[0]?.[0] || text;
  } catch (err) {
    console.error("Translation error:", err);
    return text;
  }
}

export async function getClassArticles(req: AuthenticatedRequest, res: Response) {
  try {
    const { classId } = req.params;
    const cls = await prisma.class.findUnique({
      where: { classId },
      include: { book: true },
    });

    if (!cls) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Class not found" } });
    }

    const dbArticles = await prisma.article.findMany({
      where: { bookId: cls.bookId },
    });

    // Fetch completed sessions for this class to mark completed articles
    const completedSessions = await prisma.interactiveSession.findMany({
      where: {
        classId: classId,
        status: "FINISHED"
      },
      select: { articleId: true }
    });
    const completedArticleIds = new Set(completedSessions.map(s => s.articleId));

    const articles = await Promise.all(
      dbArticles.map(async (art) => {
        const details = await getArticleDetails(art.articleId);
        
        let thaiSummary = "";
        if (details?.translated_summary?.th?.[0]) {
          thaiSummary = details.translated_summary.th[0];
        } else if (details?.summary?.th?.[0]) {
          thaiSummary = details.summary.th[0];
        }

        if (!thaiSummary) {
          let textToTranslate = "";
          if (typeof details?.summary === "string" && details.summary) {
            textToTranslate = details.summary;
          } else if (details?.passage) {
            textToTranslate = details.passage.substring(0, 150) + "...";
          }

          if (textToTranslate) {
            thaiSummary = await translateToThai(textToTranslate);
          }
        }

        let displayCefr = details?.cefr_level || "A1";
        // Normalize non-standard CEFR strings:
        // 1. If A0, convert to A1
        if (displayCefr === "A0") displayCefr = "A1";
        // 2. Strip non-alphanumeric characters (e.g. A1- to A1)
        displayCefr = displayCefr.replace(/[^a-zA-Z0-9]/g, '');

        return {
          id: art.articleId,
          articleNumber: parseInt(art.articleId.replace(/\D/g, "")) || 1,
          title: details?.title || art.title || "Untitled Article",
          summary: thaiSummary || "ไม่มีสรุปเนื้อหาสำหรับบทความนี้",
          passage: details?.passage?.substring(0, 120) + "...", // Return a snippet for passage display
          cefrLevel: displayCefr,
          isCompleted: completedArticleIds.has(art.articleId)
        };
      }),
    );

    articles.sort((a, b) => a.articleNumber - b.articleNumber);

    return res.status(200).json({ articles });
  } catch (error: any) {
    console.error("Get Class Articles Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch class articles",
      },
    });
  }
}
