import { Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { getArticleDetails } from "../services/ReadingAdvantageDB";
import { LineNotificationService } from "../services/LineNotificationService";
import { redeemCoupon, validateCoupon, CouponError } from "../services/couponService";

// Maximum live-teaching hours allowed per class schedule
const MAX_CLASS_HOURS = 22;

export async function createClass(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const { bookId, title, capacity, scheduleDescription, scheduleData, startsAt, endsAt, totalHours, couponCode, isDemo } = req.body;
    // A coupon or demo class makes the class free for students — price is forced to 0.
    const isCouponClass = typeof couponCode === "string" && couponCode.trim().length > 0;
    const isDemoClass = isDemo === true;
    const packagePriceSatang = (isCouponClass || isDemoClass) ? 0 : (req.body.packagePriceSatang ?? 250000);

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
      !isCouponClass && !isDemoClass &&
      (!Number.isInteger(packagePriceSatang) || packagePriceSatang <= 0)
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_PRICE",
          message: "packagePriceSatang must be a positive integer",
          requestId: req.id,
        },
      });
    }

    // Validate the coupon up front so its free hours can extend the schedulable
    // limit. Re-validated atomically inside the transaction on redeem.
    let couponHours = 0;
    if (isCouponClass) {
      const validated = await validateCoupon(couponCode, userId);
      couponHours = validated.hours;
    }

    const hoursLimit = MAX_CLASS_HOURS + couponHours;
    if (typeof totalHours === "number" && totalHours > hoursLimit) {
      return res.status(400).json({
        error: {
          code: "HOURS_EXCEEDED",
          message: `Scheduled teaching hours (${totalHours}) exceed the ${hoursLimit}-hour limit`,
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

    // Demo classes always teach the book's first article (fixed content),
    // so the book must have at least one. They expire 24 hours after creation.
    if (isDemoClass) {
      const firstArticle = await prisma.article.findFirst({
        where: { bookId: book.bookId },
        orderBy: { createdAt: "asc" },
      });
      if (!firstArticle) {
        return res.status(400).json({
          error: {
            code: "NO_ARTICLE",
            message: "This book has no articles available for demo",
            requestId: req.id,
          },
        });
      }
    }

    const newClass = await prisma.$transaction(async (tx) => {
      const demoExpiresAt = isDemoClass
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : undefined;

      const cls = await tx.class.create({
        data: {
          tutorUserId: userId,
          bookId: book.bookId,
          title,
          capacity,
          packagePriceMinor: BigInt(packagePriceSatang),
          scheduleDescription,
          scheduleData: scheduleData || null,
          meetingUrl: req.body.meetingUrl,
          startsAt: startsAt ? new Date(startsAt) : undefined,
          endsAt: endsAt ? new Date(endsAt) : undefined,
          isDemo: isDemoClass,
          expiresAt: demoExpiresAt,
          status: "OPEN",
        },
      });

      // Redeem the coupon (if any) and grant its hours to the new free class.
      if (isCouponClass) {
        const hours = await redeemCoupon(tx, couponCode, userId, cls.classId, "NEW_CLASS");
        await tx.class.update({
          where: { classId: cls.classId },
          data: { freeHours: hours },
        });
        cls.freeHours = hours;
      }

      await tx.classBookCycle.create({
        data: {
          classId: cls.classId,
          bookId: book.bookId,
          sequence: 1,
          status: "OPEN",
          packagePriceMinor: BigInt(packagePriceSatang),
        },
      });

      // Demo classes get a referral token created automatically.
      let referralToken: string | null = null;
      if (isDemoClass) {
        const token = randomUUID();
        await tx.referral.create({
          data: { token, classId: cls.classId, tutorUserId: userId, status: "ACTIVE" },
        });
        referralToken = token;
      }

      return { ...cls, referralToken };
    });

    return res.status(201).json({
      message: "Class created successfully",
      class: {
        ...serializeClass(newClass),
        referralToken: (newClass as any).referralToken ?? null,
        expiresAt: (newClass as any).expiresAt ?? null,
        isDemo: (newClass as any).isDemo ?? false,
      },
    });
  } catch (error: any) {
    if (error instanceof CouponError) {
      const status =
        error.code === "COUPON_NOT_FOUND"
          ? 404
          : error.code === "COUPON_NOT_ASSIGNED"
            ? 403
            : 409;
      return res.status(status).json({
        error: { code: error.code, message: error.message, requestId: req.id },
      });
    }
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

async function getCycleProgress(classId: string, bookIds: string[]) {
  if (bookIds.length === 0) return new Map<string, { completed: number; total: number }>();

  const [articles, sessions] = await Promise.all([
    prisma.article.findMany({
      where: { bookId: { in: bookIds } },
      select: { bookId: true, articleId: true },
    }),
    prisma.interactiveSession.findMany({
      where: {
        classId,
        status: "FINISHED",
        bookId: { in: bookIds },
      },
      select: { bookId: true, articleId: true },
    }).catch(() => []),
  ]);

  const totals = new Map<string, Set<string>>();
  for (const article of articles) {
    const set = totals.get(article.bookId) ?? new Set<string>();
    set.add(article.articleId);
    totals.set(article.bookId, set);
  }

  const completed = new Map<string, Set<string>>();
  for (const session of sessions) {
    if (!session.bookId) continue;
    const set = completed.get(session.bookId) ?? new Set<string>();
    set.add(session.articleId);
    completed.set(session.bookId, set);
  }

  const result = new Map<string, { completed: number; total: number }>();
  for (const bookId of bookIds) {
    result.set(bookId, {
      completed: completed.get(bookId)?.size ?? 0,
      total: totals.get(bookId)?.size ?? 0,
    });
  }

  return result;
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
      const isDemoFilter = req.query.isDemo === "true" ? true : req.query.isDemo === "false" ? false : undefined;
      classes = await prisma.class.findMany({
        where: {
          tutorUserId: userId,
          ...(isDemoFilter !== undefined ? { isDemo: isDemoFilter } : {}),
        },
        include: { book: { include: { series: true } }, referrals: { select: { token: true }, take: 1 }, _count: { select: { enrollments: true } } },
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
      classId: c.classId,
      name: c.title || (c as any).book?.title || "Untitled Class",
      book: (c as any).book?.title || "Unknown Book",
      bookTitle: (c as any).book?.title || "Unknown Book",
      bookId: c.bookId,
      cefrLevel: (c as any).book?.series?.cefrLevel || null,
      status: c.status.toLowerCase(),
      students: c.enrolledCount || 0,
      enrolledCount: c.enrolledCount || 0,
      maxStudents: c.capacity,
      capacity: c.capacity,
      packagePriceSatang: Number(c.packagePriceMinor),
      tutorUserId: c.tutorUserId,
      tutorName: tutorMap.get(c.tutorUserId) || "Unknown Tutor",
      nextSession: c.scheduleDescription || "ยังไม่ได้กำหนด",
      scheduleData: (c as any).scheduleData || null,
      startsAt: c.startsAt ?? null,
      endsAt: c.endsAt ?? null,
      isDemo: (c as any).isDemo ?? false,
      expiresAt: (c as any).expiresAt ?? null,
      referralToken: (c as any).referrals?.[0]?.token ?? null,
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
        bookCycles: {
          include: {
            book: { include: { series: true } },
          },
          orderBy: { sequence: "asc" },
        },
        enrollments: {
          include: {
            packageAccess: true,
          },
        },
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
      select: { displayName: true, profilePictureUrl: true },
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
    let bookCycles = cls.bookCycles || [];
    if (bookCycles.length === 0) {
      const defaultCycle = await prisma.classBookCycle.create({
        data: {
          classId: cls.classId,
          bookId: cls.bookId,
          sequence: 1,
          status: "OPEN",
          packagePriceMinor: cls.packagePriceMinor,
        },
        include: { book: { include: { series: true } } },
      }).catch(() => null);
      bookCycles = defaultCycle ? [defaultCycle] : [];
    }
    const accessByCycleId = new Map(
      (currentEnrollment?.packageAccess || []).map((access: any) => [
        access.classBookCycleId,
        access,
      ]),
    );
    const cycleProgressByBookId = await getCycleProgress(
      cls.classId,
      bookCycles.map((cycle: any) => cycle.bookId),
    );
    const activeCycle =
      [...bookCycles].reverse().find((cycle: any) => cycle.status === "OPEN") ||
      bookCycles[bookCycles.length - 1] ||
      null;
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
      freeHours: cls.freeHours || 0,
      independentHours: cls.book?.independentHours || 0,
      articleCount: bookArticleCount,
      activeBookCycleId: activeCycle?.classBookCycleId || null,
      activeBookId: activeCycle?.bookId || cls.bookId,
      bookCycles: bookCycles.map((cycle: any) => {
        const access = accessByCycleId.get(cycle.classBookCycleId) as any;
        const progress = cycleProgressByBookId.get(cycle.bookId) || {
          completed: 0,
          total: cycle.book?.articleCount || 0,
        };
        const isOriginalBook = cycle.bookId === cls.bookId && cycle.sequence === 1;
        const hasAccess =
          cls.tutorUserId === userId ||
          role === "ADMIN" ||
          access?.status === "ACTIVE" ||
          (isActiveEnrollment && isOriginalBook && !access);
        const totalArticles = progress.total || cycle.book?.articleCount || 0;

        return {
          id: cycle.classBookCycleId,
          bookId: cycle.bookId,
          sequence: cycle.sequence,
          status: cycle.status.toLowerCase(),
          title: cycle.book?.title || "Unknown Book",
          bookCode: cycle.book?.bookCode || null,
          cefr: cycle.book?.series?.cefrLevel || null,
          level: cycle.book?.levelNumber || null,
          packagePriceSatang: Number(cycle.packagePriceMinor),
          price: Number(cycle.packagePriceMinor) / 100,
          accessStatus: access?.status || (hasAccess ? "ACTIVE" : "LOCKED"),
          hasAccess,
          progress: {
            completedArticles: progress.completed,
            totalArticles,
            percent: totalArticles ? Math.round((progress.completed / totalArticles) * 100) : 0,
          },
        };
      }),
      nextSession: cls.scheduleDescription || "ยังไม่ได้กำหนด",
      startsAt: cls.startsAt,
      endsAt: cls.endsAt,
      schedule: cls.scheduleDescription || "ยังไม่ได้กำหนด",
      scheduleData: cls.scheduleData || null,
      meetingUrl:
        cls.tutorUserId === userId || isActiveEnrollment ? cls.meetingUrl || "" : "",
      tutor: {
        name: tutor?.displayName || "Unknown Tutor",
        initials: getInitials(tutor?.displayName),
        pictureUrl: tutor?.profilePictureUrl || null,
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
    if (process.env.NODE_ENV !== "development") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Class not found" },
      });
    }

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
      await prisma.enrollmentPackage.deleteMany({
        where: { enrollmentId: { in: enrollmentIds } },
      });
      await prisma.enrollment.deleteMany({ where: { classId } });
      await prisma.referral.deleteMany({ where: { classId } });
      await prisma.classTransferRequest.deleteMany({ where: { classId } });
      await prisma.classBookCycle.deleteMany({ where: { classId } });

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

export async function rescheduleClass(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { classId } = req.params;
    const { scheduleDescription, scheduleData, startsAt, endsAt, totalHours } = req.body;

    if (!userId) {
      return res
        .status(401)
        .json({ error: { code: "UNAUTHORIZED", message: "User ID missing" } });
    }

    const cls = await prisma.class.findUnique({
      where: { classId },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          select: { studentUserId: true },
        },
      },
    });

    if (!cls || cls.tutorUserId !== userId) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Class not found or unauthorized" },
      });
    }

    // Coupon-granted free hours extend the schedulable limit beyond the base cap.
    const hoursLimit = MAX_CLASS_HOURS + (cls.freeHours || 0);
    if (typeof totalHours === "number" && totalHours > hoursLimit) {
      return res.status(400).json({
        error: {
          code: "HOURS_EXCEEDED",
          message: `Scheduled teaching hours (${totalHours}) exceed the ${hoursLimit}-hour limit`,
          requestId: req.id,
        },
      });
    }

    const updated = await prisma.class.update({
      where: { classId },
      data: {
        scheduleDescription: scheduleDescription ?? cls.scheduleDescription,
        scheduleData: scheduleData !== undefined ? scheduleData : (cls as any).scheduleData,
        startsAt: startsAt ? new Date(startsAt) : cls.startsAt,
        endsAt: endsAt ? new Date(endsAt) : cls.endsAt,
      },
    });

    // Notify enrolled students about the new schedule
    const studentIds = cls.enrollments.map((e) => e.studentUserId);
    if (studentIds.length > 0) {
      const classLink = LineNotificationService.buildLiffDeepLink(`/classes/${classId}`);
      const message = [
        `ตารางเรียนของคลาส "${cls.title}" มีการเปลี่ยนแปลง`,
        updated.scheduleDescription ? `ตารางใหม่: ${updated.scheduleDescription}` : "",
        classLink ? `ดูรายละเอียด: ${classLink}` : "",
      ].filter(Boolean).join("\n");

      Promise.allSettled(
        studentIds.map((sid) =>
          LineNotificationService.sendToUser(sid, message, {
            type: "notifyClassReminders",
          }),
        ),
      ).catch((e) => console.error("Reschedule Notification Error:", e));
    }

    return res.status(200).json({
      message: "Class rescheduled successfully",
      class: serializeClass(updated),
    });
  } catch (error: any) {
    console.error("Reschedule Class Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not reschedule class",
        details: error.message,
        requestId: req.id,
      },
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
    const userId = req.user?.userId;
    const role = req.user?.role;
    const requestedCycleId = typeof req.query.cycleId === "string" ? req.query.cycleId : null;
    const cls = await prisma.class.findUnique({
      where: { classId },
      include: {
        book: true,
        bookCycles: { orderBy: { sequence: "asc" } },
      },
    });

    if (!cls) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Class not found" } });
    }

    const enrollment = userId && role === "STUDENT"
      ? await prisma.enrollment.findFirst({
          where: { classId, studentUserId: userId, status: "ACTIVE" },
          include: { packageAccess: true },
        })
      : null;
    const activeAccessCycleIds = new Set(
      (enrollment?.packageAccess || [])
        .filter((access: any) => access.status === "ACTIVE")
        .map((access: any) => access.classBookCycleId),
    );
    const canAccessCycle = (item: any) =>
      role === "TUTOR" ||
      role === "ADMIN" ||
      activeAccessCycleIds.has(item.classBookCycleId) ||
      Boolean(enrollment && item.sequence === 1 && item.bookId === cls.bookId);

    let cycle = requestedCycleId
      ? cls.bookCycles.find((item: any) => item.classBookCycleId === requestedCycleId)
      : role === "STUDENT" && enrollment
        ? [...cls.bookCycles].reverse().find((item: any) => canAccessCycle(item)) || cls.bookCycles[0]
        : [...cls.bookCycles].reverse().find((item: any) => item.status === "OPEN") || cls.bookCycles[0];

    if (requestedCycleId && !cycle) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Book cycle not found" } });
    }

    if (cycle && requestedCycleId && role === "STUDENT" && !canAccessCycle(cycle)) {
      return res.status(402).json({
        error: {
          code: "PAYMENT_REQUIRED",
          message: "Payment is required to access this book",
        },
      });
    }

    if (!cycle) {
      cycle = await prisma.classBookCycle.create({
        data: {
          classId: cls.classId,
          bookId: cls.bookId,
          sequence: 1,
          status: "OPEN",
          packagePriceMinor: cls.packagePriceMinor,
        },
      });
    }

    const dbArticlesRaw = await prisma.article.findMany({
      where: { bookId: cycle.bookId },
    });

    // Sort articles by their numeric articleId so order is stable and sequential
    const dbArticles = [...dbArticlesRaw].sort((a, b) => {
      const aNum = parseInt(a.articleId.replace(/\D/g, ""), 10) || 0;
      const bNum = parseInt(b.articleId.replace(/\D/g, ""), 10) || 0;
      return aNum - bNum;
    });

    // Fetch completed sessions for this class to mark completed articles
    const completedSessions = await prisma.interactiveSession.findMany({
      where: {
        classId: classId,
        bookId: cycle.bookId,
        status: "FINISHED"
      },
      select: { articleId: true }
    }).catch((error) => {
      console.warn("Could not fetch completed interactive sessions:", error);
      return [];
    });
    const completedArticleIds = new Set(completedSessions.map(s => s.articleId));

    const articles = await Promise.all(
      dbArticles.map(async (art, index) => {
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
          bookId: cycle.bookId,
          classBookCycleId: cycle.classBookCycleId,
          articleNumber: index + 1,
          title: details?.title || art.title || "Untitled Article",
          summary: thaiSummary || "ไม่มีสรุปเนื้อหาสำหรับบทความนี้",
          passage: details?.passage ? `${details.passage.substring(0, 120)}...` : "", // Return a snippet for passage display
          cefrLevel: displayCefr,
          imageUrl: art.articleId ? `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${art.articleId}.png` : null,
          isCompleted: completedArticleIds.has(art.articleId)
        };
      }),
    );

    return res.status(200).json({
      cycle: {
        id: cycle.classBookCycleId,
        bookId: cycle.bookId,
        sequence: cycle.sequence,
        status: cycle.status.toLowerCase(),
        packagePriceSatang: Number(cycle.packagePriceMinor),
      },
      articles,
    });
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

export async function createClassBookCycle(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { classId } = req.params;
    const { bookId } = req.body;
    const packagePriceSatang = req.body.packagePriceSatang ?? 250000;

    if (!userId || req.user?.role !== "TUTOR") {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED_ROLE", message: "Only tutors can open a new class book" },
      });
    }

    if (!bookId || !Number.isInteger(packagePriceSatang) || packagePriceSatang <= 0) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "bookId and positive packagePriceSatang are required" },
      });
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookId);
    const book = await prisma.book.findFirst({
      where: isUuid ? { bookId } : { bookCode: bookId },
      include: { series: true },
    });

    if (!book) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Book not found" },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const cls = await tx.class.findUnique({
        where: { classId },
        include: {
          bookCycles: true,
          enrollments: { where: { status: "ACTIVE" } },
        },
      });

      if (!cls || cls.tutorUserId !== userId) {
        throw new Error("CLASS_NOT_FOUND");
      }

      const existing = cls.bookCycles.find((item: any) => item.bookId === book.bookId);
      if (existing) {
        throw new Error("BOOK_ALREADY_OPEN");
      }

      const orderedBooks = await tx.book.findMany({
        select: { bookId: true },
        orderBy: [
          { series: { raLevelStart: "asc" } },
          { levelNumber: "asc" },
          { bookCode: "asc" },
        ],
      });
      const selectedBookIndex = orderedBooks.findIndex((item) => item.bookId === book.bookId);
      const openedBookIndexes = cls.bookCycles
        .map((cycle: any) => orderedBooks.findIndex((item) => item.bookId === cycle.bookId))
        .filter((index: number) => index >= 0);
      const highestOpenedBookIndex =
        openedBookIndexes.length > 0 ? Math.max(...openedBookIndexes) : -1;

      if (selectedBookIndex >= 0 && selectedBookIndex < highestOpenedBookIndex) {
        throw new Error("BOOK_BELOW_OPENED");
      }

      if (selectedBookIndex > highestOpenedBookIndex + 1) {
        throw new Error("BOOK_SEQUENCE_SKIPPED");
      }

      const nextSequence =
        cls.bookCycles.reduce((max: number, item: any) => Math.max(max, item.sequence || 0), 0) + 1;

      const created = await tx.classBookCycle.create({
        data: {
          classId,
          bookId: book.bookId,
          sequence: nextSequence,
          status: "OPEN",
          packagePriceMinor: BigInt(packagePriceSatang),
        },
      });

      if (cls.enrollments.length > 0) {
        await tx.enrollmentPackage.createMany({
          data: cls.enrollments.map((enrollment: any) => ({
            enrollmentId: enrollment.enrollmentId,
            classBookCycleId: created.classBookCycleId,
            studentUserId: enrollment.studentUserId,
            status: "PENDING_PAYMENT",
          })),
          skipDuplicates: true,
        });
      }

      return {
        cycle: created,
        studentUserIds: cls.enrollments.map((enrollment: any) => enrollment.studentUserId),
      };
    });

    const cycle = result.cycle;
    if (result.studentUserIds.length > 0) {
      const paymentLink = LineNotificationService.buildLiffDeepLink(
        `/payment?classId=${classId}&cycleId=${cycle.classBookCycleId}`,
      );
      const message = [
        `เล่มใหม่เปิดแล้ว: ${book.title}`,
        "กรุณาชำระเงินเพื่อเข้าเรียน live lesson ของเล่มนี้",
        paymentLink ? `ชำระเงิน: ${paymentLink}` : "",
      ].filter(Boolean).join("\n");

      Promise.allSettled(
        result.studentUserIds.map((studentUserId: string) =>
          LineNotificationService.sendToUser(studentUserId, message, {
            type: "notifyClassReminders",
          }),
        ),
      ).catch((notifyError) => {
        console.error("Class Book Cycle Notification Error:", notifyError);
      });
    }

    return res.status(201).json({
      cycle: {
        id: cycle.classBookCycleId,
        classId: cycle.classId,
        bookId: cycle.bookId,
        title: book.title,
        cefr: book.series?.cefrLevel || null,
        sequence: cycle.sequence,
        status: cycle.status.toLowerCase(),
        packagePriceSatang: Number(cycle.packagePriceMinor),
      },
    });
  } catch (error: any) {
    if (error.message === "CLASS_NOT_FOUND") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Class not found or unauthorized" },
      });
    }

    const bookCycleMessages: Record<string, string> = {
      BOOK_ALREADY_OPEN: "This book is already open for this class",
      BOOK_BELOW_OPENED: "Cannot open a book below the latest opened book",
      BOOK_SEQUENCE_SKIPPED: "Open the previous book before skipping ahead",
    };

    if (bookCycleMessages[error.message]) {
      return res.status(409).json({
        error: { code: error.message, message: bookCycleMessages[error.message] },
      });
    }

    console.error("Create Class Book Cycle Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not open class book" },
    });
  }
}

export async function prepareClassBookCycleAccess(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { classId, cycleId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User ID missing" },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { classId, studentUserId: userId, status: "ACTIVE" },
        include: { class: true },
      });

      if (!enrollment) {
        const pendingEnrollment = await tx.enrollment.findFirst({
          where: { classId, studentUserId: userId, status: "PENDING_PAYMENT" },
        });
        if (pendingEnrollment) {
          throw new Error("ENROLLMENT_PAYMENT_PENDING");
        }
        throw new Error("NOT_ENROLLED");
      }

      const cycle = await tx.classBookCycle.findFirst({
        where: { classBookCycleId: cycleId, classId },
        include: { book: { include: { series: true } } },
      });

      if (!cycle) {
        throw new Error("CYCLE_NOT_FOUND");
      }

      const existing = await tx.enrollmentPackage.findUnique({
        where: {
          enrollmentId_classBookCycleId: {
            enrollmentId: enrollment!.enrollmentId,
            classBookCycleId: cycle.classBookCycleId,
          },
        },
      });

      if (existing?.status === "ACTIVE") {
        return { enrollment: enrollment!, cycle, access: existing };
      }

      const access = existing
        ? await tx.enrollmentPackage.update({
            where: { enrollmentPackageId: existing.enrollmentPackageId },
            data: { status: "PENDING_PAYMENT" },
          })
        : await tx.enrollmentPackage.create({
            data: {
              enrollmentId: enrollment!.enrollmentId,
              classBookCycleId: cycle.classBookCycleId,
              studentUserId: userId,
              status: "PENDING_PAYMENT",
            },
          });

      return { enrollment: enrollment!, cycle, access };
    });

    return res.status(200).json({
      enrollmentId: result.enrollment.enrollmentId,
      enrollmentPackageId: result.access.enrollmentPackageId,
      status: result.access.status,
      amountSatang: Number(result.cycle.packagePriceMinor),
      cycle: {
        id: result.cycle.classBookCycleId,
        bookId: result.cycle.bookId,
        title: result.cycle.book?.title || "Unknown Book",
        cefr: result.cycle.book?.series?.cefrLevel || null,
        sequence: result.cycle.sequence,
      },
    });
  } catch (error: any) {
    if (error.message === "NOT_ENROLLED") {
      return res.status(403).json({
        error: { code: "NOT_ENROLLED", message: "Please enroll in the class first" },
      });
    }
    if (error.message === "ENROLLMENT_PAYMENT_PENDING") {
      return res.status(409).json({
        error: { code: "ENROLLMENT_PAYMENT_PENDING", message: "Please complete your class enrollment payment first" },
      });
    }
    if (error.message === "CYCLE_NOT_FOUND") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Book cycle not found" },
      });
    }

    console.error("Prepare Class Book Cycle Access Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not prepare upgrade access" },
    });
  }
}
