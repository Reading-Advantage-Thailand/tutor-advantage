import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { logger } from "@tutor-advantage/shared-config";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { supportsAssessment } from "../services/origins2Assessment";

class AssessmentError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const fail = (status: number, code: string, message: string): never => { throw new AssessmentError(status, code, message); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function access(req: AuthenticatedRequest, teacher = false) {
  if (!req.user) return fail(401, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบ");
  if (!uuid.test(req.params.cycleId)) return fail(400, "INVALID_ID", "รหัสเล่มไม่ถูกต้อง");
  const cycle = await prisma.classBookCycle.findUnique({ where: { classBookCycleId: req.params.cycleId }, include: { book: { include: { series: true } }, class: true } });
  if (!cycle) return fail(404, "NOT_FOUND", "ไม่พบรอบการเรียนนี้");
  if (teacher) {
    if (req.user.role !== "TUTOR" || cycle.class.tutorUserId !== req.user.userId) return fail(403, "FORBIDDEN", "เฉพาะครูเจ้าของคลาส");
  } else {
    if (req.user.role !== "STUDENT") return fail(403, "FORBIDDEN", "สำหรับนักเรียนในคลาสเท่านั้น");
    const enrollment = await prisma.enrollment.findFirst({ where: { classId: cycle.classId, studentUserId: req.user.userId, status: "ACTIVE" }, include: { packageAccess: true } });
    const packageAccess = enrollment?.packageAccess.find(p => p.classBookCycleId === cycle.classBookCycleId);
    const hasAccess = enrollment && (packageAccess ? packageAccess.status === "ACTIVE" : cycle.sequence === 1 && cycle.bookId === cycle.class.bookId);
    if (!hasAccess) return fail(403, "FORBIDDEN", "ยังไม่มีสิทธิ์เรียนเล่มนี้");
  }
  return cycle;
}
function requireSupported(cycle: Awaited<ReturnType<typeof access>>) {
  if (!supportsAssessment(cycle.book) || cycle.class.isDemo) fail(404, "UNSUPPORTED_BOOK", "การประเมินทดลองเปิดเฉพาะ Primary Origins 2");
}
const resultSelect = { attemptId: true, studentUserId: true, stage: true, formVersion: true, startedAt: true, submittedAt: true, scores: true, total: true, teacherComment: true, commentedAt: true } as const;
function endpoint(fn: (req: AuthenticatedRequest) => Promise<unknown>) {
  return async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    try { res.json(await fn(req)); }
    catch (error) {
      if (error instanceof AssessmentError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
      logger.error("Assessment request failed", error);
      res.status(500).json({ error: { code: "ASSESSMENT_ERROR", message: "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง" } });
    }
  };
}
export const getAssessment = endpoint(async req => {
  const cycle = await access(req);
  if (!supportsAssessment(cycle.book) || cycle.class.isDemo) return { supported: false };
  const [window, attempts] = await Promise.all([
    prisma.assessmentWindow.findUnique({ where: { classBookCycleId: cycle.classBookCycleId } }),
    prisma.assessmentAttempt.findMany({ where: { classBookCycleId: cycle.classBookCycleId, studentUserId: req.user!.userId }, select: resultSelect }),
  ]);
  return { supported: true, title: "Primary Origins 2", postOpenedAt: window?.postOpenedAt ?? null, attempts };
});
// The retired self-service endpoints cannot bypass the live room controller.
export const startAssessment = endpoint(async req => {
  requireSupported(await access(req));
  return fail(409, "TEACHER_CONTROLLED", "เข้าห้อง Lobby และรอครูเริ่มแบบประเมิน");
});
export const submitAssessment = endpoint(async req => {
  requireSupported(await access(req));
  return fail(409, "TEACHER_CONTROLLED", "ส่งคำตอบจากห้องที่ครูเปิดเท่านั้น");
});
export const getAssessmentReport = endpoint(async req => {
  const cycle = await access(req, true); requireSupported(cycle);
  const [window, attempts, enrollments] = await Promise.all([
    prisma.assessmentWindow.findUnique({ where: { classBookCycleId: cycle.classBookCycleId } }),
    prisma.assessmentAttempt.findMany({ where: { classBookCycleId: cycle.classBookCycleId }, select: resultSelect }),
    prisma.enrollment.findMany({ where: { classId: cycle.classId, status: "ACTIVE" }, include: { packageAccess: true } }),
  ]);
  const eligible = enrollments.filter(e => {
    const packageAccess = e.packageAccess.find(p => p.classBookCycleId === cycle.classBookCycleId);
    return packageAccess ? packageAccess.status === "ACTIVE" : cycle.sequence === 1 && cycle.bookId === cycle.class.bookId;
  });
  const ids = [...new Set([...eligible.map(e => e.studentUserId), ...attempts.map(a => a.studentUserId)])];
  const students = await prisma.user.findMany({ where: { userId: { in: ids } }, select: { userId: true, displayName: true }, orderBy: { displayName: "asc" } });
  return { postOpenedAt: window?.postOpenedAt ?? null, students: students.map(s => ({ ...s, attempts: attempts.filter(a => a.studentUserId === s.userId) })) };
});
export const openPostAssessment = endpoint(async req => {
  requireSupported(await access(req, true));
  return fail(409, "TEACHER_CONTROLLED", "เลือกก่อน/หลังเรียนและกดเริ่มจาก Lobby");
});
export const commentAssessment = endpoint(async req => {
  const cycle = await access(req, true); requireSupported(cycle);
  if (!uuid.test(req.params.attemptId) || typeof req.body?.comment !== "string" || req.body.comment.length > 2000) return fail(400, "INVALID_COMMENT", "ความเห็นต้องไม่เกิน 2,000 ตัวอักษร");
  const updated = await prisma.assessmentAttempt.updateMany({ where: { attemptId: req.params.attemptId, classBookCycleId: cycle.classBookCycleId, submittedAt: { not: null } }, data: { teacherComment: req.body.comment.trim(), commentedAt: new Date(), commentedBy: req.user!.userId } });
  if (!updated.count) return fail(404, "NOT_FOUND", "ไม่พบผลประเมิน");
  return { saved: true };
});
