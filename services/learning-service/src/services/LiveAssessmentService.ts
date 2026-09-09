import { prisma, Prisma } from "@tutor-advantage/database";
import type { AssessmentControl, LiveAssessmentState } from "@tutor-advantage/shared-config";
import { FORM_VERSION, FORMS, grade, publicItems, Stage, supportsAssessment } from "./origins2Assessment";
import type { LessonSession } from "./LessonSessionService";

export class LiveAssessmentError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const fail = (code: string, message: string): never => { throw new LiveAssessmentError(code, message); };
const drafts = (value: unknown): Record<string, number> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, number> : {};
async function serial<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) { if (attempt < 3 && ["P2002", "P2034"].includes((error as { code?: string }).code || "")) continue; throw error; }
  }
}
async function room(tx: Prisma.TransactionClient, session: LessonSession) {
  if (session.isDemo || !session.classBookCycleId || !session.classId) return fail("UNSUPPORTED", "การประเมินเปิดเฉพาะคลาส Primary Origins 2");
  const live = await tx.interactiveSession.findUnique({ where: { sessionId: session.sessionId } });
  const cycle = await tx.classBookCycle.findUnique({ where: { classBookCycleId: session.classBookCycleId }, include: { book: { include: { series: true } }, class: true } });
  if (!live || !cycle || cycle.classId !== session.classId || cycle.class.tutorUserId !== session.tutorId || live.classBookCycleId !== cycle.classBookCycleId || live.currentPhase !== 0 || live.status !== "ACTIVE") return fail("LOBBY_REQUIRED", "กรุณากลับ Lobby ก่อนเลือกกิจกรรม");
  if (!supportsAssessment(cycle.book)) return fail("UNSUPPORTED", "การประเมินเปิดเฉพาะ Primary Origins 2");
  const lock = await tx.activeLessonSessionLock.findUnique({ where: { classId: cycle.classId } });
  if (!lock || lock.sessionId !== session.sessionId || Date.now() - lock.lastHeartbeatAt.getTime() > 45_000) return fail("ROOM_PAUSED", "กำลังรอการเชื่อมต่อของครู กรุณาลองอีกครั้ง");
  return { live, cycle };
}
export async function controlAssessment(session: LessonSession, control: AssessmentControl) {
  if (!control || !Number.isInteger(control.revision) || !["select", "start", "finish", "reset"].includes(control.action)) return fail("INVALID_CONTROL", "คำสั่งไม่ถูกต้อง");
  return serial(async tx => {
    const { live, cycle } = await room(tx, session);
    if (control.revision !== live.assessmentRevision) return fail("STALE_CONTROL", "สถานะห้องเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
    const where = { sessionId: session.sessionId, assessmentRevision: control.revision, currentPhase: 0 };
    if (control.action === "reset") {
      if (process.env.NODE_ENV !== "development") return fail("DEV_ONLY", "รีเซ็ตผลประเมินได้เฉพาะโหมดพัฒนา");
      await tx.assessmentAttempt.deleteMany({ where: { classBookCycleId: cycle.classBookCycleId } });
      await tx.assessmentWindow.deleteMany({ where: { classBookCycleId: cycle.classBookCycleId } });
      await tx.interactiveSession.update({ where, data: { assessmentMode: "LESSON", assessmentStatus: "LOBBY", assessmentStartedAt: null, assessmentRevision: { increment: 1 } } });
      return;
    }
    if (control.action === "select") {
      if (!["LESSON", "PRE", "POST"].includes(control.mode)) return fail("INVALID_MODE", "เลือกบทเรียน ก่อนเรียน หรือหลังเรียน");
      if (live.assessmentStatus === "RUNNING") return fail("RUNNING", "จบแบบประเมินก่อนเปลี่ยนกิจกรรม");
      const window = await tx.assessmentWindow.findUnique({ where: { classBookCycleId: cycle.classBookCycleId } });
      if (control.mode === "PRE" && window?.postOpenedAt) return fail("PRE_CLOSED", "เริ่มหลังเรียนไปแล้ว จึงไม่สามารถสร้างผลก่อนเรียนย้อนหลัง");
      await tx.interactiveSession.update({ where, data: { assessmentMode: control.mode, assessmentStatus: "LOBBY", assessmentStartedAt: null, assessmentRevision: { increment: 1 } } });
      return;
    }
    if (live.assessmentMode !== "PRE" && live.assessmentMode !== "POST") return fail("SELECT_ASSESSMENT", "เลือกแบบประเมินก่อน");
    const stage = live.assessmentMode as Stage;
    if (control.action === "start") {
      if (live.assessmentStatus !== "LOBBY") return fail("ALREADY_STARTED", "แบบประเมินเริ่มไปแล้ว");
      if (!session.participants.size) return fail("NO_STUDENTS", "รอนักเรียนเข้าห้องก่อนเริ่ม");
      if (Array.from(session.participants.values()).some(participant => !participant.isReady)) return fail("STUDENTS_NOT_READY", "รอให้นักเรียนทุกคนกดพร้อมก่อนเริ่ม");
      const window = await tx.assessmentWindow.findUnique({ where: { classBookCycleId: cycle.classBookCycleId } });
      if (stage === "PRE" && window?.postOpenedAt) return fail("PRE_CLOSED", "ปิดการประเมินก่อนเรียนแล้ว");
      if (stage === "POST") await tx.assessmentWindow.upsert({ where: { classBookCycleId: cycle.classBookCycleId }, create: { classBookCycleId: cycle.classBookCycleId, postOpenedAt: new Date(), openedBy: session.tutorId }, update: {} });
      await tx.interactiveSession.update({ where, data: { assessmentStatus: "RUNNING", assessmentStartedAt: new Date(), assessmentRevision: { increment: 1 } } });
      return;
    }
    if (live.assessmentStatus !== "RUNNING") return fail("NOT_RUNNING", "แบบประเมินยังไม่เริ่มหรือจบแล้ว");
    const attempts = await tx.assessmentAttempt.findMany({ where: { classBookCycleId: cycle.classBookCycleId, stage, assessmentSessionId: session.sessionId, submittedAt: null } });
    for (const attempt of attempts) {
      if (attempt.formVersion !== FORM_VERSION || Object.keys(drafts(attempt.draftAnswers)).length !== 15) continue;
      const result = grade(stage, attempt.draftAnswers);
      await tx.assessmentAttempt.update({ where: { attemptId: attempt.attemptId }, data: { ...result, submittedAt: new Date() } });
    }
    // Incomplete drafts remain unscored; do not manufacture a poor result.
    await tx.interactiveSession.update({ where, data: { assessmentStatus: "FINISHED", assessmentRevision: { increment: 1 } } });
  });
}
export async function saveAssessmentAnswer(session: LessonSession, studentId: string, input: { revision: number; questionId: string; choice: number }) {
  if (!input || !Number.isInteger(input.revision) || typeof input.questionId !== "string" || !Number.isInteger(input.choice) || input.choice < 0 || input.choice > 3) return fail("INVALID_ANSWER", "คำตอบไม่ถูกต้อง");
  await serial(async tx => {
    const { live, cycle } = await room(tx, session);
    if (live.assessmentStatus !== "RUNNING" || !["PRE", "POST"].includes(live.assessmentMode) || live.assessmentRevision !== input.revision) return fail("NOT_RUNNING", "ครูยังไม่เริ่ม หรือจบแบบประเมินแล้ว");
    const stage = live.assessmentMode as Stage;
    if (!FORMS[stage].some(item => item.id === input.questionId)) return fail("INVALID_ANSWER", "ข้อนี้ไม่อยู่ในแบบประเมินที่ครูเปิด");
    const enrollment = await tx.enrollment.findFirst({ where: { classId: cycle.classId, studentUserId: studentId, status: "ACTIVE" }, include: { packageAccess: true } });
    const paid = enrollment?.packageAccess.find(p => p.classBookCycleId === cycle.classBookCycleId);
    if (!enrollment || (paid ? paid.status !== "ACTIVE" : cycle.sequence !== 1 || cycle.bookId !== cycle.class.bookId)) return fail("ACCESS_DENIED", "ไม่มีสิทธิ์เรียนเล่มนี้");
    const where = { classBookCycleId_studentUserId_stage: { classBookCycleId: cycle.classBookCycleId, studentUserId: studentId, stage } };
    const existing = await tx.assessmentAttempt.findUnique({ where });
    if (existing?.submittedAt) return fail("ALREADY_COMPLETED", "มีผลประเมินช่วงนี้แล้ว");
    if (existing && existing.formVersion !== FORM_VERSION) return fail("VERSION_CHANGED", "กรุณาติดต่อครูเกี่ยวกับแบบประเมินเวอร์ชันเดิม");
    // Each new supervised room starts a fresh unsubmitted draft. Recorded scores
    // remain immutable. The question-level write safely retries on reconnect.
    const previous = existing?.assessmentSessionId === session.sessionId ? drafts(existing.draftAnswers) : {};
    const draftAnswers = { ...previous, [input.questionId]: input.choice };
    await tx.assessmentAttempt.upsert({ where, create: { classBookCycleId: cycle.classBookCycleId, studentUserId: studentId, stage, formVersion: FORM_VERSION, assessmentSessionId: session.sessionId, startedAt: live.assessmentStartedAt || new Date(), draftAnswers }, update: { assessmentSessionId: session.sessionId, draftAnswers, startedAt: live.assessmentStartedAt || new Date() } });
  });
}
export async function assessmentSnapshot(session: LessonSession, studentId?: string): Promise<LiveAssessmentState> {
  const blank: LiveAssessmentState = { sessionId: session.sessionId, supported: false, mode: "LESSON", status: "LOBBY", revision: 0, postOpened: false, paused: false, items: [], answers: {}, completed: false, progress: [] };
  if (session.isDemo || !session.classBookCycleId || !session.classId) return blank;
  const cycle = await prisma.classBookCycle.findUnique({ where: { classBookCycleId: session.classBookCycleId }, include: { book: { include: { series: true } }, class: true } });
  if (!cycle || !supportsAssessment(cycle.book)) return blank;
  if (studentId) {
    const enrollment = await prisma.enrollment.findFirst({ where: { classId: cycle.classId, studentUserId: studentId, status: "ACTIVE" }, include: { packageAccess: true } });
    const paid = enrollment?.packageAccess.find(p => p.classBookCycleId === cycle.classBookCycleId);
    if (!enrollment || (paid ? paid.status !== "ACTIVE" : cycle.sequence !== 1 || cycle.bookId !== cycle.class.bookId)) return fail("ACCESS_DENIED", "ไม่มีสิทธิ์เรียนเล่มนี้");
  }
  const [live, window, lock] = await Promise.all([
    prisma.interactiveSession.findUnique({ where: { sessionId: session.sessionId } }),
    prisma.assessmentWindow.findUnique({ where: { classBookCycleId: cycle.classBookCycleId } }),
    prisma.activeLessonSessionLock.findUnique({ where: { classId: session.classId } }),
  ]);
  if (!live) return blank;
  const paused = !lock || lock.sessionId !== session.sessionId || Date.now() - lock.lastHeartbeatAt.getTime() > 45_000 || live.currentPhase !== 0 || live.status !== "ACTIVE";
  const attempts = live.assessmentMode === "LESSON" ? [] : await prisma.assessmentAttempt.findMany({ where: { classBookCycleId: cycle.classBookCycleId, stage: live.assessmentMode, ...(studentId ? { studentUserId: studentId } : {}) }, include: { student: { select: { displayName: true } } } });
  const own = studentId ? attempts.find(a => a.studentUserId === studentId) : undefined;
  const roster = new Map(Array.from(session.participants.values()).map(p => [p.resolvedUserId || p.studentId, { studentId: p.studentId, name: p.name, connected: true }]));
  for (const attempt of attempts) {
    if (attempt.assessmentSessionId === session.sessionId && !roster.has(attempt.studentUserId)) roster.set(attempt.studentUserId, { studentId: attempt.studentUserId, name: attempt.student?.displayName || "นักเรียนที่ออกจากห้อง", connected: false });
  }
  return {
    ...blank, supported: true, mode: live.assessmentMode as LiveAssessmentState["mode"], status: live.assessmentStatus as LiveAssessmentState["status"], revision: live.assessmentRevision, postOpened: Boolean(window?.postOpenedAt), paused,
    items: live.assessmentStatus === "RUNNING" && live.assessmentMode !== "LESSON" && !own?.submittedAt && !paused ? publicItems(live.assessmentMode as Stage) : [],
    answers: own?.assessmentSessionId === session.sessionId ? drafts(own.draftAnswers) : {},
    completed: Boolean(own?.submittedAt),
    progress: studentId ? [] : Array.from(roster.entries()).map(([userId, p]) => {
      const a = attempts.find(a => a.studentUserId === userId);
      const count = a?.submittedAt ? 15 : a?.assessmentSessionId === session.sessionId ? Object.keys(drafts(a.draftAnswers)).length : 0;
      return { ...p, answered: count, completed: count === 15, previouslyCompleted: Boolean(a?.submittedAt && a.assessmentSessionId !== session.sessionId) };
    }),
  };
}
