import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { assertAttendanceAvailable, loadAttendanceOverview, loadClass, sendAttendanceError } from "./attendanceController";
import { errorBody } from "./ticketController";

/* Admin console /classes/:id/attendance: read-only. An admin is not a tutor and cannot mark. */

// GET /v1/admin/classes/:classId/attendance
export async function getAdminClassAttendance(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.userId) return res.status(401).json(errorBody(req, "UNAUTHORIZED", "Authentication required"));
  if (req.user.role !== "ADMIN") {
    return res.status(403).json(errorBody(req, "FORBIDDEN", "Only admins can view this"));
  }
  try {
    const cls = await loadClass(prisma, req.params.classId);
    assertAttendanceAvailable(cls);
    const [tutor, overview] = await Promise.all([
      prisma.user.findUnique({ where: { userId: cls.tutorUserId }, select: { displayName: true } }),
      loadAttendanceOverview(cls, new Date()),
    ]);
    return res.status(200).json({
      class: { classId: cls.classId, title: cls.title, tutorName: tutor?.displayName ?? null },
      ...overview,
    });
  } catch (error) {
    return sendAttendanceError(req, res, error, "Load class attendance");
  }
}
