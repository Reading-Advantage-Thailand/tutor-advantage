import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { formatIctPeriodMonth, getIctMonthWindow } from "../services/commissionService";

export async function exportTutorSalesCsv(
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

    const periodMonth = (req.query.periodMonth as string) || formatIctPeriodMonth();
    const { start: monthStart, end: monthEnd } = getIctMonthWindow(periodMonth);

    // 1. Find classes taught by this tutor
    const classes = await prisma.class.findMany({
      where: { tutorUserId: userId },
      select: { classId: true, title: true, packagePriceMinor: true },
    });

    const classMap = new Map(classes.map(c => [c.classId, c]));

    // 2. Find successful payments for these classes within the period
    const enrollments = await prisma.enrollment.findMany({
      where: { classId: { in: Array.from(classMap.keys()) } },
      select: { enrollmentId: true, classId: true, studentUserId: true },
    });
    
    const enrollmentMap = new Map(enrollments.map(e => [e.enrollmentId, e]));

    const payments = await prisma.paymentIntent.findMany({
      where: {
        status: "SUCCESS",
        updatedAt: { gte: monthStart, lte: monthEnd },
        enrollmentId: { in: Array.from(enrollmentMap.keys()) },
      },
      orderBy: { updatedAt: "asc" }
    });

    // Manually fetch student users
    const studentIds = [...new Set(payments.map(p => p.studentUserId))];
    const students = await prisma.user.findMany({
      where: { userId: { in: studentIds } },
      select: { userId: true, displayName: true, email: true }
    });
    const studentMap = new Map(students.map(s => [s.userId, s]));

    // 3. Generate CSV
    const headers = ["Date", "Student Name", "Student Email", "Class Title", "Package Price (THB)", "Paid Amount (THB)", "Status"];
    const rows = payments.map(payment => {
      const enrollment = enrollmentMap.get(payment.enrollmentId!);
      const classInfo = enrollment ? classMap.get(enrollment.classId) : null;
      const student = studentMap.get(payment.studentUserId);
      
      const date = payment.updatedAt.toISOString();
      const studentName = student?.displayName || "Unknown";
      const studentEmail = student?.email || "Unknown";
      const classTitle = classInfo?.title || "Unknown Class";
      const packagePrice = classInfo ? Number(classInfo.packagePriceMinor) / 100 : 0;
      const paidAmount = Number(payment.amountMinor) / 100;
      
      return [
        date,
        `"${studentName.replace(/"/g, '""')}"`,
        `"${studentEmail.replace(/"/g, '""')}"`,
        `"${classTitle.replace(/"/g, '""')}"`,
        packagePrice.toFixed(2),
        paidAmount.toFixed(2),
        payment.status
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    // Add BOM for Excel UTF-8 support
    const bom = "\uFEFF";

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sales-report-${periodMonth}.csv"`
    );
    
    return res.status(200).send(bom + csvContent);

  } catch (error) {
    logger.error("Export Tutor Sales CSV Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not generate CSV" }
    });
  }
}
