import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FORMS } from "./origins2Assessment";
import type { LessonSession } from "./LessonSessionService";
const { db } = vi.hoisted(() => ({ db: {
  interactiveSession: { findUnique: vi.fn(), update: vi.fn() },
  classBookCycle: { findUnique: vi.fn() }, activeLessonSessionLock: { findUnique: vi.fn() },
  assessmentWindow: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  assessmentAttempt: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  enrollment: { findFirst: vi.fn() }, $transaction: vi.fn(),
} }));
vi.mock("@tutor-advantage/database", () => ({ prisma: db, Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } }));
import { assessmentSnapshot, controlAssessment, saveAssessmentAnswer } from "./LiveAssessmentService";
const session = { sessionId: "room", classId: "class", classBookCycleId: "cycle", tutorId: "tutor", participants: new Map([["student", { studentId: "student", name: "Student", socketId: "socket", isReady: true }]]) } as LessonSession;
const cycle = { classBookCycleId: "cycle", classId: "class", bookId: "book", sequence: 1, class: { bookId: "book", tutorUserId: "tutor" }, book: { bookCode: "Primary Origins 2", levelNumber: 20, series: { code: "PRIMARY-ORIGINS" } } };
const live = { sessionId: "room", classBookCycleId: "cycle", currentPhase: 0, status: "ACTIVE", assessmentMode: "PRE", assessmentStatus: "RUNNING", assessmentRevision: 2, assessmentStartedAt: new Date() };
const correct = Object.fromEntries(FORMS.PRE.map(i => [i.id, i.correct]));
describe("teacher-led assessment lifecycle", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation(fn => fn(db));
    db.interactiveSession.findUnique.mockResolvedValue(live);
    db.classBookCycle.findUnique.mockResolvedValue(cycle);
    db.activeLessonSessionLock.findUnique.mockResolvedValue({ sessionId: "room", lastHeartbeatAt: new Date() });
    db.assessmentWindow.findUnique.mockResolvedValue(null);
    db.assessmentAttempt.findUnique.mockResolvedValue(null);
    db.assessmentAttempt.findMany.mockResolvedValue([]);
    db.enrollment.findFirst.mockResolvedValue({ packageAccess: [] });
  });
  it("does not expose questions before the teacher starts", async () => {
    db.interactiveSession.findUnique.mockResolvedValue({ ...live, assessmentStatus: "LOBBY" });
    const state = await assessmentSnapshot(session, "student");
    expect(state.items).toEqual([]); expect(state.progress).toEqual([]);
  });
  it("returns the whole test only while running, with no keys or transcript", async () => {
    const state = await assessmentSnapshot(session, "student");
    expect(state.items).toHaveLength(15); expect(JSON.stringify(state.items)).not.toMatch(/correct|audioText/);
    expect(state.progress).toEqual([]);
  });
  it("saves one answer without grading or submitting the test", async () => {
    await saveAssessmentAnswer(session, "student", { revision: 2, questionId: "a-v1", choice: 1 });
    expect(db.assessmentAttempt.upsert.mock.calls[0][0]).toMatchObject({ create: { studentUserId: "student", stage: "PRE", assessmentSessionId: "room", draftAnswers: { "a-v1": 1 } } });
    expect(db.assessmentAttempt.update).not.toHaveBeenCalled();
  });
  it("preserves other saved answers on retry and allows self-paced question order", async () => {
    db.assessmentAttempt.findUnique.mockResolvedValue({ formVersion: "primary-origins2-v1", assessmentSessionId: "room", draftAnswers: { "a-v1": 1 } });
    await saveAssessmentAnswer(session, "student", { revision: 2, questionId: "a-l5", choice: 2 });
    expect(db.assessmentAttempt.upsert.mock.calls[0][0].update.draftAnswers).toEqual({ "a-v1": 1, "a-l5": 2 });
  });
  it("rejects late answers, forged question ids, invalid choices and stale room revisions", async () => {
    await expect(saveAssessmentAnswer(session, "student", { revision: 2, questionId: "b-v1", choice: 1 })).rejects.toThrow("ข้อนี้ไม่อยู่");
    await expect(saveAssessmentAnswer(session, "student", { revision: 2, questionId: "a-v1", choice: 9 })).rejects.toThrow("คำตอบไม่ถูกต้อง");
    await expect(saveAssessmentAnswer(session, "student", { revision: 1, questionId: "a-v1", choice: 1 })).rejects.toThrow("ครูยังไม่เริ่ม");
    db.interactiveSession.findUnique.mockResolvedValue({ ...live, assessmentStatus: "FINISHED" });
    await expect(saveAssessmentAnswer(session, "student", { revision: 2, questionId: "a-v1", choice: 1 })).rejects.toThrow("ครูยังไม่เริ่ม");
    expect(db.assessmentAttempt.upsert).not.toHaveBeenCalled();
  });
  it("blocks revoked book access and preserves first recorded results", async () => {
    db.enrollment.findFirst.mockResolvedValue({ packageAccess: [{ classBookCycleId: "cycle", status: "REVOKED" }] });
    await expect(saveAssessmentAnswer(session, "student", { revision: 2, questionId: "a-v1", choice: 1 })).rejects.toThrow("ไม่มีสิทธิ์");
    db.enrollment.findFirst.mockResolvedValue({ packageAccess: [] });
    db.assessmentAttempt.findUnique.mockResolvedValue({ submittedAt: new Date() });
    await expect(saveAssessmentAnswer(session, "student", { revision: 2, questionId: "a-v1", choice: 1 })).rejects.toThrow("มีผลประเมิน");
  });
  it("teacher finish grades only complete drafts in this session", async () => {
    db.assessmentAttempt.findMany.mockResolvedValue([{ attemptId: "full", formVersion: "primary-origins2-v1", draftAnswers: correct }, { attemptId: "partial", formVersion: "primary-origins2-v1", draftAnswers: { "a-v1": 1 } }]);
    await controlAssessment(session, { action: "finish", revision: 2 });
    expect(db.assessmentAttempt.update).toHaveBeenCalledTimes(1);
    expect(db.assessmentAttempt.update.mock.calls[0][0]).toMatchObject({ where: { attemptId: "full" }, data: { total: 15, scores: { vocabulary: 5, reading: 5, listening: 5 } } });
    expect(db.assessmentAttempt.findMany.mock.calls[0][0].where).toMatchObject({ assessmentSessionId: "room", submittedAt: null });
    expect(db.interactiveSession.update.mock.calls[0][0].data.assessmentStatus).toBe("FINISHED");
  });
  it("cannot change activity during a running assessment", async () => {
    await expect(controlAssessment(session, { action: "select", mode: "LESSON", revision: 2 })).rejects.toThrow("จบแบบประเมินก่อน");
    expect(db.interactiveSession.update).not.toHaveBeenCalled();
  });
  it("opens post only on teacher start and rejects retroactive pre", async () => {
    db.interactiveSession.findUnique.mockResolvedValue({ ...live, assessmentMode: "POST", assessmentStatus: "LOBBY" });
    await controlAssessment(session, { action: "start", revision: 2 });
    expect(db.assessmentWindow.upsert.mock.calls[0][0].create.openedBy).toBe("tutor");
    expect(db.interactiveSession.update.mock.calls[0][0].data.assessmentStatus).toBe("RUNNING");
    db.assessmentWindow.findUnique.mockResolvedValue({ postOpenedAt: new Date() });
    await expect(controlAssessment(session, { action: "select", mode: "PRE", revision: 2 })).rejects.toThrow("ไม่สามารถสร้างผลก่อนเรียน");
  });
  it("resets all assessment data only in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await controlAssessment(session, { action: "reset", revision: 2 });
    expect(db.assessmentAttempt.deleteMany).toHaveBeenCalledWith({ where: { classBookCycleId: "cycle" } });
    expect(db.assessmentWindow.deleteMany).toHaveBeenCalledWith({ where: { classBookCycleId: "cycle" } });
    expect(db.interactiveSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assessmentMode: "LESSON", assessmentStatus: "LOBBY", assessmentStartedAt: null, assessmentRevision: { increment: 1 } }) }));
  });
  it("rejects assessment reset outside development", async () => {
    await expect(controlAssessment(session, { action: "reset", revision: 2 })).rejects.toThrow("เฉพาะโหมดพัฒนา");
    expect(db.assessmentAttempt.deleteMany).not.toHaveBeenCalled();
  });
  it("refuses controls from stale views, empty rooms, active lessons and stale leases", async () => {
    await expect(controlAssessment(session, { action: "finish", revision: 0 })).rejects.toThrow("สถานะห้องเปลี่ยน");
    db.interactiveSession.findUnique.mockResolvedValue({ ...live, assessmentStatus: "LOBBY" });
    await expect(controlAssessment({ ...session, participants: new Map() }, { action: "start", revision: 2 })).rejects.toThrow("รอนักเรียน");
    await expect(controlAssessment({ ...session, participants: new Map([["student", { studentId: "student", isReady: false }]]) } as LessonSession, { action: "start", revision: 2 })).rejects.toThrow("ทุกคนกดพร้อม");
    db.interactiveSession.findUnique.mockResolvedValue({ ...live, currentPhase: 1 });
    await expect(controlAssessment(session, { action: "finish", revision: 2 })).rejects.toThrow("Lobby");
    db.interactiveSession.findUnique.mockResolvedValue(live);
    db.activeLessonSessionLock.findUnique.mockResolvedValue({ sessionId: "room", lastHeartbeatAt: new Date(0) });
    await expect(controlAssessment(session, { action: "finish", revision: 2 })).rejects.toThrow("รอการเชื่อมต่อ");
  });
  it("teacher progress includes unanswered students without exposing answer choices", async () => {
    db.assessmentAttempt.findMany.mockResolvedValue([{ studentUserId: "student", assessmentSessionId: "room", draftAnswers: { "a-v1": 1 } }]);
    const state = await assessmentSnapshot(session);
    expect(state.progress[0]).toMatchObject({ name: "Student", answered: 1, completed: false });
    expect(state.answers).toEqual({});
  });
  it("retries database serialization conflicts", async () => {
    db.$transaction.mockRejectedValueOnce({ code: "P2034" });
    await saveAssessmentAnswer(session, "student", { revision: 2, questionId: "a-v1", choice: 1 });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });
});
