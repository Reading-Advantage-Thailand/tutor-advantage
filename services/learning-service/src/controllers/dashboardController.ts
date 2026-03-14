import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

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

    // 1. Fetch all classes owned by the tutor
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

    // Calculate classes this week (placeholder logic)
    const classesThisWeek = classes.length > 0 ? Math.min(classes.length, 5) : 0;

    return res.status(200).json({
      openClasses: openClassesCount,
      totalStudents,
      classesThisWeek,
      recentClasses,
    });
  } catch (error: any) {
    console.error("Dashboard Summary Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: error.message },
    });
  }
}
