import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { getArticleDetails } from "../services/ReadingAdvantageDB";
import { LineNotificationService } from "../services/LineNotificationService";
import { redeemCoupon, validateCoupon, CouponError } from "../services/couponService";

// Maximum live-teaching hours allowed per class schedule
const MAX_CLASS_HOURS = 22;
// Keep the legacy code until every deployed database has run the Reading rename migration.
const AVAILABLE_BOOK_CODES = new Set(["Reading 3.1", "Origins 3.1"]);

function isBookAvailable(book?: { bookCode?: string | null } | null) {
  return Boolean(
    book?.bookCode &&
      (AVAILABLE_BOOK_CODES.has(book.bookCode) || book.bookCode.startsWith("Primary ")),
  );
}

function unavailableBookResponse(req: AuthenticatedRequest) {
  return {
    error: {
      code: "BOOK_UNAVAILABLE",
      message: "This course level is temporarily unavailable. Only Reading 3.1 is open right now.",
      requestId: req.id,
    },
  };
}

const curatedArticleOrder = new Map<string, number>(
  [
    "cmjfm919v0232s60eo0tzv1x8",
    "i4iNzw6AArWrTOU0SE6f",
    "cmixr8kil000us60esgwguw0z",
    "mQBtacaks53c7Djci9n6",
    "cmgu0xb0i00rqs60e2djeq0xt",
    "h31ImmMoHtDQS3jxOuOy",
    "PfzjAu0eSyuUokFK2rnk",
    "7UQDbGLuIPZbE7yYa33x",
    "5a3MFFCMZSJLOc2CXiy2",
    "ok5b5Be1QOBPzX2as2S4",
    "BHusTKr0h8i6vOhbrfpx",
    "rY1QKnciUBBhE9MyadbF",
    "cmitgx6xd000ts60ew7qdd5a4",
    "AEh9oRp1WDa8CApSdrCr",
    "KzUwB5Uc6139Fw5fcnpx",
    "cmkgrpes5003os60ex7cqbzva",
    "9VRaZ4coQyiz4gJW91av",
    "cml5szh5o00aas60e5wv1q9ez",
    "XTXZcvdQ1juCo7wSnmtZ",
    "iSYAqKTgtXABlx5IYuNY",
    "CRiCha2pxDeP0xx1KqnS",
    "xAo8XxZoSl5fpbkicsqe",
    "4ZZeSspAGo285csIxNcc",
    "gyWWNG0hzEt4bFEHkGX1",
    "ayOLHwUR3JnnjVsY43yc",
    "BwJEsTpAiGfxqxvSmRZ3",
    "7MrOtihsv9tsz3SaBfVC",
    "7apvHQXjJb8od9KowL92",
    "0tVl8K7MCiecTPJ1lmdE",
    "cmkmhgh5501lds60ev7s791s5",
    "cmjw1t3ky00mps60etppweqpu",
    "cmmscy4zq00wys60eetu0jbr2",
    "5whpV1ZrLk7qb1lgAJnT",
    "fzMRYypdLSTFhc8rdM7h",
    "1lnzzXylJmtQWd39qmkQ",
    "vGLJOdqIOYsJS0orm79e",
    "ZT2sa9qiH0lHnYH9ayfF",
    "cmmtse9p801a4s60en4k8d32q",
    "nFZObhzKbSGn5IFMbmf4",
    "AgYv5H7fCZL2u2N4qBwT",
    "uT67FwqUlttv74p2snCr",
    "OyEA0jRP5GnpFZBCrgMl",
    "lsiMiDgyCV9MbBjKjsyl",
    "KkJOkCCBrfYWBMtrw7AZ",
    "MjtQFpxdhlewLdgvwZMx",
    "cmn57x04l00f2s60et9r9k1c6",
    "YbIjlPcIZbnBlcvJ1q9J",
    "cmmki0z6z0002s60e30ppdzvg",
    "juueom8cpLZvs4fZHdDd",
    "vxElH4I71CEIAKxbU9bD",
    "4KEEDPYfLpRWutFuYceS",
    "cmjhremv1000ds60ew177qfxg",
    "b20DYB3KOU2GLYJv1Y1r",
    "Bm9w2y9wQAf1Fr4mYUzA",
    "MMmPVvbXr1LnBo7P0oTT",
  ].map((articleId, index) => [articleId, index]),
);

const hiddenCuratedArticleIds = new Set(["44QFyTUgeUGPKf9gfLlL"]);

function compareArticlesByCatalogOrder<
  T extends { articleId: string; createdAt?: Date | string | null },
>(a: T, b: T) {
  const aOrder = curatedArticleOrder.get(a.articleId);
  const bOrder = curatedArticleOrder.get(b.articleId);

  if (aOrder !== undefined || bOrder !== undefined) {
    return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
  }

  const aCreatedAt = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bCreatedAt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (aCreatedAt !== bCreatedAt) return aCreatedAt - bCreatedAt;

  return a.articleId.localeCompare(b.articleId);
}

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
      (!Number.isSafeInteger(packagePriceSatang) || packagePriceSatang <= 0)
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_PRICE",
          message: "packagePriceSatang must be a positive safe integer",
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

    if (!isBookAvailable(book)) {
      return res.status(403).json(unavailableBookResponse(req));
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

      // Limit 1 active demo per tutor
      const activeDemoCount = await prisma.class.count({
        where: {
          tutorUserId: userId,
          isDemo: true,
          expiresAt: { gt: new Date() },
        },
      });

      if (activeDemoCount >= 1) {
        return res.status(403).json({
          error: {
            code: "LIMIT_EXCEEDED",
            message: "You can only have 1 active demo class at a time.",
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
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
    logger.error("Create Class Error:", error);
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

function normalizeCefrLevel(value: unknown, fallback = "A1") {
  const normalized = String(value ?? fallback)
    .trim()
    .replace(/^CEFR\s*/i, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return normalized || fallback;
}

function mapClassStatus(status: string, enrolledCount: number, capacity: number) {
  if (status !== "OPEN") return status.toLowerCase();
  return enrolledCount >= capacity ? "full" : "open";
}

export function formatNextSession(scheduleDesc: string | null, scheduleData: any): string {
  let base = scheduleDesc || "ตามนัดหมาย";
  if (Array.isArray(scheduleData) && scheduleData.length > 0) {
    const first = scheduleData[0];
    if (first && first.start && first.end) {
      if (!base.includes("เวลา") && !base.includes(first.start)) {
        base += ` เวลา ${first.start}-${first.end} น.`;
      }
    }
  }
  return base;
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Close Class Error:", error);
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

export async function updateClassStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { classId } = req.params;
    const { status } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User ID missing from token", requestId: req.id },
      });
    }

    if (!status || !["open", "full", "closed"].includes(status.toLowerCase())) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Invalid status provided", requestId: req.id },
      });
    }

    const existingClass = await prisma.class.findUnique({
      where: { classId },
    });

    if (!existingClass) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Class not found", requestId: req.id },
      });
    }

    if (existingClass.tutorUserId !== userId) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You can only update your own classes", requestId: req.id },
      });
    }

    const updatedClass = await prisma.class.update({
      where: { classId },
      data: { status: status.toUpperCase() },
    });

    return res.status(200).json({
      message: "Class status updated successfully",
      class: updatedClass,
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Update Class Status Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not update class status",
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
      nextSession: formatNextSession(c.scheduleDescription, (c as any).scheduleData),
      scheduleData: (c as any).scheduleData || null,
      startsAt: c.startsAt ?? null,
      endsAt: c.endsAt ?? null,
      isDemo: (c as any).isDemo ?? false,
      expiresAt: (c as any).expiresAt ?? null,
      referralToken: (c as any).referrals?.[0]?.token ?? null,
    }));

    return res.status(200).json({ classes: mappedClasses });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Get Classes Error:", error);
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
            articles: { orderBy: [ { createdAt: "asc" }, { articleId: "asc" } ], take: 3 },
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
    const bookArticleCount = cls.isDemo ? 1 : (cls.book?.articleCount || cls.book?.articles?.length || 0);
    const status = mapClassStatus(cls.status, activeOrPendingStudents, cls.capacity);
    const firstArticle = cls.book?.articles?.[0];
    const mapped = {
      id: cls.classId,
      name: cls.title || cls.book?.title || "Untitled Class",
      book: cls.book?.title || "Unknown Book",
      bookCode: cls.book?.bookCode || null,
      seriesName: "Reading",
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
      nextSession: formatNextSession(cls.scheduleDescription, (cls as any).scheduleData),
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
        (cls.isDemo ? cls.book?.articles?.slice(0, 1) : cls.book?.articles)?.map((article: any, index: number) => ({
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Get Class By ID Error:", error);
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
        seriesName: "Reading",
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
        nextSession: formatNextSession(c.scheduleDescription, (c as any).scheduleData),
      };
    });

    return res.status(200).json({ classes: mappedClasses });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Get Available Classes Error:", error);
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
      where: {
        OR: [
          { bookCode: { in: Array.from(AVAILABLE_BOOK_CODES) } },
          { bookCode: { startsWith: "Primary " } },
        ],
      },
      include: { series: true },
      orderBy: [
        { series: { raLevelStart: "asc" } },
        { levelNumber: "asc" },
        { bookCode: "asc" },
      ],
    });

    return res.status(200).json({ books });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Get Books Error:", error);
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
    // Environment check moved below to allow Demo class deletion in all environments

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
      },
    });

    if (!cls || cls.tutorUserId !== userId) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Class not found" } });
    }

    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
    if (!isDev && !(cls as any).isDemo) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Cannot delete a non-demo class in production" },
      });
    }

    const enrollmentIds = cls.enrollments.map((e) => e.enrollmentId);

    logger.info(`[DELETE_CLASS] Starting deletion for class: ${classId}`);

    // Break down into smaller steps for better error visibility
    try {
      if (enrollmentIds.length > 0) {
        logger.info(
          `[DELETE_CLASS] Step 1: Cleaning up Finance records for ${enrollmentIds.length} enrollments...`,
        );
        // PaymentReceipts reference PaymentIntents
        const receiptsDeleted = await prisma.paymentReceipt.deleteMany({
          where: { paymentIntent: { enrollmentId: { in: enrollmentIds } } },
        });
        logger.info(`[DELETE_CLASS] Deleted ${receiptsDeleted.count} payment receipts`);

        // PaymentEvents reference PaymentIntents
        const eventsDeleted = await prisma.paymentEvent.deleteMany({
          where: { paymentIntent: { enrollmentId: { in: enrollmentIds } } },
        });
        logger.info(
          `[DELETE_CLASS] Deleted ${eventsDeleted.count} payment events`,
        );

        // PaymentIntents reference Enrollments
        const intentsDeleted = await prisma.paymentIntent.deleteMany({
          where: { enrollmentId: { in: enrollmentIds } },
        });
        logger.info(
          `[DELETE_CLASS] Deleted ${intentsDeleted.count} payment intents`,
        );
      }

      logger.info(`[DELETE_CLASS] Step 2: Cleaning up Chat records (handled by CASCADE)...`);

      logger.info(`[DELETE_CLASS] Step 3: Cleaning up Learning relations...`);
      
      // Enrollment packages and Enrollments still need manual cleanup (as per Option A)
      await prisma.enrollmentPackage.deleteMany({
        where: { enrollmentId: { in: enrollmentIds } },
      });
      await prisma.enrollment.deleteMany({ where: { classId } });
      
      // InteractiveSession, SessionAnswer, SessionParticipant, Referral, ClassTransferRequest, ClassBookCycle, TutorReview 
      // are now handled by PostgreSQL ON DELETE CASCADE.
      logger.info(`[DELETE_CLASS] Step 4: Deleting the Class record itself...`);
      await prisma.class.delete({
        where: { classId },
      });

      logger.info(`[DELETE_CLASS] ✅ Successfully deleted class ${classId}`);
      return res.status(200).json({ message: "Class deleted successfully" });
    } catch (stepError_err) {
    const stepError = stepError_err as Error & { code?: string; details?: string; };
      logger.error("[DELETE_CLASS] Step Error:", stepError);
      throw stepError; // Re-throw to be caught by main catch
    }
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("[DELETE_CLASS] ❌ FINAL ERROR:", error);
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Update Meeting URL error:", error);
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
      ).catch((e) => logger.error("Reschedule Notification Error:", e));
    }

    return res.status(200).json({
      message: "Class rescheduled successfully",
      class: serializeClass(updated),
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Reschedule Class Error:", error);
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
    logger.error("Translation error:", err);
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
      orderBy: [
        { createdAt: "asc" },
        { articleId: "asc" }
      ]
    });
    const cycleBook = await prisma.book.findUnique({
      where: { bookId: cycle.bookId },
      select: { bookCode: true },
    });
    const isPrimaryBook = Boolean(cycleBook?.bookCode.startsWith("Primary "));

    let dbArticles = dbArticlesRaw
      .filter((article) => !hiddenCuratedArticleIds.has(article.articleId))
      .sort(compareArticlesByCatalogOrder);

    if (cls.isDemo) {
      dbArticles = dbArticles.slice(0, 1);
    }

    // Fetch completed sessions for this class to mark completed articles
    const completedSessions = await prisma.interactiveSession.findMany({
      where: {
        classId: classId,
        bookId: cycle.bookId,
        status: "FINISHED"
      },
      select: { articleId: true }
    }).catch((error) => {
      logger.warn("Could not fetch completed interactive sessions:", error);
      return [];
    });
    const completedArticleIds = new Set(completedSessions.map(s => s.articleId));

    const articles = await Promise.all(
      dbArticles.map(async (art, index) => {
        const details = await getArticleDetails(art.articleId, art.bookId).catch((error) => {
          logger.warn(`Could not fetch Reading Advantage details for article ${art.articleId}:`, error);
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

        const displayCefr = normalizeCefrLevel(details?.cefr_level);
        const primaryImageUrls = Array.isArray((details as any)?.image_urls)
          ? (details as any).image_urls.filter((url: unknown): url is string => typeof url === "string" && url.length > 0)
          : [];
        const imageUrl = primaryImageUrls[0] || (art.articleId.startsWith("workbook:")
          ? null
          : `https://storage.googleapis.com/artifacts.reading-advantage.appspot.com/images/${art.articleId}.png`);

        return {
          id: art.articleId,
          bookId: cycle.bookId,
          classBookCycleId: cycle.classBookCycleId,
          articleNumber: index + 1,
          title: details?.title || art.title || "Untitled Article",
          summary: thaiSummary || "ไม่มีสรุปเนื้อหาสำหรับบทความนี้",
          passage: details?.passage ? `${details.passage.substring(0, 120)}...` : "", // Return a snippet for passage display
          cefrLevel: isPrimaryBook ? null : displayCefr,
          showCefr: !isPrimaryBook,
          imageUrl,
          imageUrls: primaryImageUrls,
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Get Class Articles Error:", error);
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

    if (!isBookAvailable(book)) {
      return res.status(403).json(unavailableBookResponse(req));
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
        logger.error("Class Book Cycle Notification Error:", notifyError);
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
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

    logger.error("Create Class Book Cycle Error:", error);
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
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

    logger.error("Prepare Class Book Cycle Access Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not prepare upgrade access" },
    });
  }
}
