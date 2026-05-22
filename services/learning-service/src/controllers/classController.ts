import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { getArticleDetails } from "../services/ReadingAdvantageDB";

export async function createClass(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { bookId, title, capacity, scheduleDescription } = req.body;
    const packagePriceSatang = req.body.packagePriceSatang ?? 250000;

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

    if (
      !Number.isInteger(packagePriceSatang) ||
      packagePriceSatang <= 0
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_PRICE",
          message: "packagePriceSatang must be a positive integer",
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
        packagePriceMinor: BigInt(packagePriceSatang),
        scheduleDescription,
        meetingUrl: req.body.meetingUrl,
        status: "OPEN",
      },
    });

    return res.status(201).json({
      message: "Class created successfully",
      class: serializeClass(newClass),
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

function serializeClass<T extends { packagePriceMinor?: bigint | number | null }>(
  cls: T,
) {
  return {
    ...cls,
    packagePriceMinor:
      cls.packagePriceMinor === undefined || cls.packagePriceMinor === null
        ? cls.packagePriceMinor
        : Number(cls.packagePriceMinor),
  };
}

function getSeriesColor(cefrStr?: string | null) {
  switch (cefrStr?.toUpperCase()) {
    case "A1":
      return "#06c755";
    case "A2":
      return "#3b82f6";
    case "B1":
      return "#f59e0b";
    case "B2":
      return "#8b5cf6";
    default:
      return "#06c755";
  }
}

function mapClassStatus(status: string, enrolledCount: number, capacity: number) {
  if (status !== "OPEN") return status.toLowerCase();
  return enrolledCount >= capacity ? "full" : "open";
}

function getInitials(name?: string | null) {
  if (!name) return "TA";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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
        where: { studentUserId: userId, status: "ACTIVE" },
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
      students: c.enrolledCount || 0,
      maxStudents: c.capacity,
      packagePriceSatang: Number(c.packagePriceMinor),
      tutorUserId: c.tutorUserId,
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
      include: {
        book: {
          include: {
            series: true,
            articles: { orderBy: { articleId: "asc" }, take: 3 },
          },
        },
        enrollments: true,
        _count: { select: { enrollments: true } },
      } as any,
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

    const tutorStudentCount = await prisma.enrollment.count({
      where: {
        status: "ACTIVE",
        class: { tutorUserId: cls.tutorUserId },
      },
    });

    const role = req.user?.role;
    const userEnrollments =
      cls.enrollments?.filter((e: any) => e.studentUserId === userId) || [];
    const currentEnrollment =
      userEnrollments.find((e: any) => e.status === "ACTIVE") ||
      userEnrollments.find((e: any) => e.status === "PENDING_PAYMENT") ||
      userEnrollments[0];
    const isActiveEnrollment = currentEnrollment?.status === "ACTIVE";

    if (cls.tutorUserId !== userId && !isActiveEnrollment && role !== "ADMIN") {
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

    const activeOrPendingStudents = cls.enrolledCount || 0;
    const series = cls.book?.series;
    const cefr = series?.cefrLevel || "A1";
    const totalHours = cls.book?.classHours || 0;
    const bookArticleCount = cls.book?.articleCount || cls.book?.articles?.length || 0;
    const status = mapClassStatus(cls.status, activeOrPendingStudents, cls.capacity);
    const firstArticle = cls.book?.articles?.[0];
    const mapped = {
      id: cls.classId,
      name: cls.title || cls.book?.title || "Untitled Class",
      book: cls.book?.title || "Unknown Book",
      bookCode: cls.book?.bookCode || null,
      seriesName: series?.name || null,
      seriesTagline: series?.tagline || null,
      status,
      students: activeOrPendingStudents,
      maxStudents: cls.capacity,
      enrolled: activeOrPendingStudents,
      capacity: cls.capacity,
      price: Number(cls.packagePriceMinor) / 100,
      packagePriceSatang: Number(cls.packagePriceMinor),
      cefr,
      level: cls.book?.levelNumber || 1,
      seriesColor: getSeriesColor(cefr),
      totalHours,
      independentHours: cls.book?.independentHours || 0,
      articleCount: bookArticleCount,
      nextSession: cls.scheduleDescription || "ยังไม่ได้กำหนด",
      startsAt: cls.startsAt,
      schedule: cls.scheduleDescription || "ยังไม่ได้กำหนด",
      meetingUrl:
        cls.tutorUserId === userId || isActiveEnrollment ? cls.meetingUrl || "" : "",
      tutor: {
        name: tutor?.displayName || "Unknown Tutor",
        initials: getInitials(tutor?.displayName),
        students: tutorStudentCount,
      },
      articleId: firstArticle?.articleId || null,
      articles:
        cls.book?.articles?.map((article: any, index: number) => ({
          id: article.articleId,
          no: index + 1,
          title: article.title,
          type: article.type,
          genre: article.genre,
        })) || [],
      highlights: [
        `${cls.book?.title || "Reading Advantage"} ระดับ ${cefr} Level ${cls.book?.levelNumber || 1}`,
        bookArticleCount
          ? `ครอบคลุม ${bookArticleCount} บทความในชุด ${series?.name || "Reading Advantage"}`
          : `เนื้อหาจากชุด ${series?.name || "Reading Advantage"}`,
        totalHours
          ? `เรียนสดรวมประมาณ ${totalHours} ชั่วโมงตามตารางของติวเตอร์`
          : "เรียนสดตามตารางที่ติวเตอร์กำหนด",
        cls.book?.independentHours
          ? `มีเวลาเรียน/ฝึกอ่านด้วยตนเองประมาณ ${cls.book.independentHours} ชั่วโมง`
          : "ติดตามความคืบหน้าและประวัติการเรียนผ่านแอป",
      ],
      referralLink: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/enroll?classId=${cls.classId}`,
      isEnrolled: isActiveEnrollment,
      enrollmentStatus: currentEnrollment?.status || null,
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
    const { q, cefr } = req.query;
    const where: any = { status: "OPEN" };

    if (cefr && cefr !== "ทั้งหมด") {
      const targetCefr = String(cefr).split(" ").pop();
      where.book = {
        series: {
          cefrLevel: { equals: targetCefr, mode: "insensitive" }
        }
      };
    }

    if (q) {
      const searchStr = String(q);
      const matchingTutors = await prisma.user.findMany({
        where: { displayName: { contains: searchStr, mode: "insensitive" } },
        select: { userId: true }
      });
      const matchingTutorIds = matchingTutors.map(u => u.userId);

      where.OR = [
        { title: { contains: searchStr, mode: "insensitive" } },
        { tutorUserId: { in: matchingTutorIds } },
        {
          book: {
            OR: [
              { title: { contains: searchStr, mode: "insensitive" } },
              { bookCode: { contains: searchStr, mode: "insensitive" } },
              { series: { name: { contains: searchStr, mode: "insensitive" } } }
            ]
          }
        }
      ];
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        book: { include: { series: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const tutorIds = [...new Set(classes.map((c) => c.tutorUserId))];
    const tutors = await prisma.user.findMany({
      where: { userId: { in: tutorIds } },
      select: { userId: true, displayName: true },
    });
    const tutorMap = new Map(tutors.map((t) => [t.userId, t.displayName]));

    const mappedClasses = classes.map((c) => {
      const tutorName = tutorMap.get(c.tutorUserId) || "Unknown Tutor";
      const seriesCefr = c.book?.series?.cefrLevel || "A1";
      const enrolled = c.enrolledCount || 0;
      return {
        id: c.classId,
        name: c.title || c.book?.title || "Untitled Class",
        tutor: tutorName,
        tutorInitials: getInitials(tutorName),
        book: c.book?.title || "Unknown Book",
        bookCode: c.book?.bookCode || null,
        seriesName: c.book?.series?.name || null,
        articleCount: c.book?.articleCount || 0,
        totalHours: c.book?.classHours || 0,
        cefr: seriesCefr,
        level: c.book?.levelNumber || 1,
        seriesColor: getSeriesColor(seriesCefr),
        status: mapClassStatus(c.status, enrolled, c.capacity),
        enrolled,
        capacity: c.capacity,
        price: Number(c.packagePriceMinor) / 100,
        packagePriceSatang: Number(c.packagePriceMinor),
        nextSession: c.scheduleDescription || "ยังไม่ได้กำหนด",
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

export async function getBooks(_req: AuthenticatedRequest, res: Response) {
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
        // PaymentReceipts reference PaymentIntents
        const receiptsDeleted = await prisma.paymentReceipt.deleteMany({
          where: { paymentIntent: { enrollmentId: { in: enrollmentIds } } },
        });
        console.log(`[DELETE_CLASS] Deleted ${receiptsDeleted.count} payment receipts`);

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
    }).catch((error) => {
      console.warn("Could not fetch completed interactive sessions:", error);
      return [];
    });
    const completedArticleIds = new Set(completedSessions.map(s => s.articleId));

    const articles = await Promise.all(
      dbArticles.map(async (art) => {
        const details = await getArticleDetails(art.articleId).catch((error) => {
          console.warn(`Could not fetch Reading Advantage details for article ${art.articleId}:`, error);
          return null;
        });
        
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

        let displayCefr = String(details?.cefr_level || "A1");
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
          passage: details?.passage ? `${details.passage.substring(0, 120)}...` : "", // Return a snippet for passage display
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
        details: process.env.NODE_ENV === "production" ? undefined : error.message,
        prismaCode: error.code,
      },
    });
  }
}
