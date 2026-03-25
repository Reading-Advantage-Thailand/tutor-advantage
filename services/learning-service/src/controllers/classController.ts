import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

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

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookId);
    let book = await prisma.book.findFirst({
      where: isUuid ? { bookId: bookId } : { bookCode: bookId }
    });

    if (!book && !isUuid) {
      // Create a mock book since it crosses from another app but doesn't exist here yet
      let mockSeries = await prisma.series.findFirst({ where: { code: "MOCK-X" } });
      if (!mockSeries) {
        mockSeries = await prisma.series.create({
          data: { code: "MOCK-X", name: "Mock Series (Cross App)", cefrLevel: "A1", raLevelStart: 1, raLevelEnd: 6 }
        });
      }
      book = await prisma.book.create({
        data: {
          bookCode: bookId,
          title: `Book: ${bookId}`,
          levelNumber: 1,
          seriesId: mockSeries.seriesId,
          articleCount: 10,
          classHours: 10
        }
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

    const classes = await prisma.class.findMany({
      where: { tutorUserId: userId },
      include: { book: true, _count: { select: { enrollments: true } } },
      orderBy: { createdAt: "desc" },
    });

    const mappedClasses = classes.map((c) => ({
      id: c.classId,
      name: c.title,
      book: c.book?.title || "Unknown Book",
      status: c.status.toLowerCase(),
      students: c._count.enrollments,
      maxStudents: c.capacity,
      nextSession: c.scheduleDescription || "ยังไม่ได้กำหนด", // Use actual schedule
    }));

    return res.status(200).json({ classes: mappedClasses });
  } catch (error: any) {
    console.error("Get Classes Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not fetch classes" },
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

    const cls = await prisma.class.findUnique({
      where: { classId },
      include: { book: true, enrollments: true },
    });

    if (!cls || cls.tutorUserId !== userId) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Class not found" },
      });
    }

    // Fetch user details for the students
    const studentIds = cls.enrollments.map((e) => e.studentUserId);
    const users = await prisma.user.findMany({
      where: { userId: { in: studentIds } },
      select: { userId: true, displayName: true },
    });

    const userMap = new Map();
    users.forEach((u) => userMap.set(u.userId, u.displayName));

    const mapped = {
      id: cls.classId,
      name: cls.title,
      book: cls.book?.title || "Unknown Book",
      status: cls.status.toLowerCase(),
      students: cls.enrollments.length,
      maxStudents: cls.capacity,
      schedule: cls.scheduleDescription || "ยังไม่ได้กำหนด", // Removed mock
      meetingUrl: "https://meet.google.com/abc-defg-hij", // Mock
      referralLink: `https://liff.line.me/9999999-XXXXXXXX?classId=${cls.classId}`,
      enrolledStudents: cls.enrollments.map((e) => ({
        name: userMap.get(e.studentUserId) || "Unknown Student",
        enrolled: e.createdAt.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        paid: e.status === "ACTIVE",
      })),
    };

    return res.status(200).json({ class: mapped });
  } catch (error: any) {
    console.error("Get Class By ID Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not fetch class" },
    });
  }
}

