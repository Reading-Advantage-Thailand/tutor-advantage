import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonSession } from "./LessonSessionService";
const { db, bank } = vi.hoisted(() => {
  const form = (stage: "pre" | "post") => [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `${stage}-v${index + 1}`, skill: "vocabulary", prompt: "word", options: ["a", "b", "c", "d"] })),
    ...Array.from({ length: 5 }, (_, index) => ({ id: `${stage}-r${index + 1}`, skill: "reading", prompt: "read", options: ["a", "b", "c", "d"], passage: "passage" })),
    ...Array.from({ length: 5 }, (_, index) => ({ id: `${stage}-l${index + 1}`, skill: "listening", prompt: "listen", options: ["a", "b", "c", "d"], audioUrl: "https://storage.googleapis.com/test/audio.mp3" })),
  ];
  const forms = { PRE: form("pre"), POST: form("post") };
  return { bank: { articleId: "article", title: "Article", version: "article-assessments-v1-test", forms, answers: { PRE: Object.fromEntries(forms.PRE.map((item) => [item.id, 0])), POST: Object.fromEntries(forms.POST.map((item) => [item.id, 0])) } }, db: {
  interactiveSession: { findUnique: vi.fn(), update: vi.fn() },
  classBookCycle: { findUnique: vi.fn() }, activeLessonSessionLock: { findUnique: vi.fn() },
  assessmentWindow: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  assessmentAttempt: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  enrollment: { findFirst: vi.fn() }, $transaction: vi.fn(),
  } };
});
vi.mock("@tutor-advantage/database", () => ({ prisma: db, Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } }));
vi.mock("./articleAssessmentBank", () => ({
  hasArticleAssessment: (articleId: string) => articleId === bank.articleId,
  loadArticleAssessment: vi.fn().mockResolvedValue(bank),
  gradeArticleAssessment: (_bank: typeof bank, stage: "PRE" | "POST", answers: Record<string, number>) => {
    const scores = { vocabulary: 0, reading: 0, listening: 0 };
    for (const item of bank.forms[stage]) if (answers[item.id] === 0) scores[item.skill as keyof typeof scores]++;
    return { answers, scores, total: Object.values(scores).reduce((sum, value) => sum + value, 0) };
  },
}));
import { assessmentSnapshot, controlAssessment, saveAssessmentAnswer } from "./LiveAssessmentService";
const session = { sessionId: "room", articleId: "article", classId: "class", classBookCycleId: "cycle", tutorId: "tutor", participants: new Map([["student", { studentId: "student", name: "Student", socketId: "socket", isReady: true }]]) } as LessonSession;
const cycle = { classBookCycleId: "cycle", classId: "class", bookId: "book", sequence: 1, class: { bookId: "book", tutorUserId: "tutor" } };
const live = { sessionId: "room", articleId: "article", classBookCycleId: "cycle", currentPhase: 0, status: "ACTIVE", assessmentMode: "PRE", assessmentStatus: "RUNNING", assessmentRevision: 2, assessmentStartedAt: new Date() };
const correct = bank.answers.PRE;
describe("teacher-led assessment lifecycle", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
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
    await saveAssessmentAnswer(session, "student", { revision: 2, questionId: "pre-v1", choice: 1 });
    expect(db.assessmentAttempt.upsert.mock.calls[0][0]).toMatchObject({ create: { articleId: "article", studentUserId: "student", stage: "PRE", assessmentSessionId: "room", draftAnswers: { "pre-v1": 1 } } });
    expect(db.assessmentAttempt.update).not.toHaveBeenCalled();
  });
  it("preserves other saved answers on retry and allows self-paced question order", async () => {
    db.assessmentAttempt.findUnique.mockResolvedValue({ formVersion: bank.version, assessmentSessionId: "room", draftAnswers: { "pre-v1": 1 } });
    await saveAssessmentAnswer(session, "student", { revision: 2, questionId: "pre-l5", choice: 2 });
    expect(db.assessmentAttempt.upsert.mock.calls[0][0].update.draftAnswers).toEqual({ "pre-v1": 1, "pre-l5": 2 });
  });
  it("rejects late answers, forged question ids, invalid choices and stale room revisions", async () => {
    await expect(saveAssessmentAnswer(session, "student", { revision: 2, questionId: "post-v1", choice: 1 })).rejects.toThrow("ข้อนี้ไม่อยู่");
    await expect(saveAssessmentAnswer(session, "student", { revision: 2, questionId: "pre-v1", choice: 9 })).rejects.toThrow("คำตอบไม่ถูกต้อง");
    await expect(saveAssessmentAnswer(session, "student", { revision: 1, questionId: "pre-v1", choice: 1 })).rejects.toThrow("ครูยังไม่เริ่ม");
    db.interactiveSession.findUnique.mockResolvedValue({ ...live, assessmentStatus: "FINISHED" });
    await expect(saveAssessmentAnswer(session, "student", { revision: 2, questionId: "pre-v1", choice: 1 })).rejects.toThrow("ครูยังไม่เริ่ม");
    expect(db.assessmentAttempt.upsert).not.toHaveBeenCalled();
  });
  it("blocks revoked book access and preserves first recorded results", async () => {
    db.enrollment.findFirst.mockResolvedValue({ packageAccess: [{ classBookCycleId: "cycle", status: "REVOKED" }] });
    await expect(saveAssessmentAnswer(session, "student", { revision: 2, questionId: "pre-v1", choice: 1 })).rejects.toThrow("ไม่มีสิทธิ์");
    db.enrollment.findFirst.mockResolvedValue({ packageAccess: [] });
    db.assessmentAttempt.findUnique.mockResolvedValue({ submittedAt: new Date() });
    await expect(saveAssessmentAnswer(session, "student", { revision: 2, questionId: "pre-v1", choice: 1 })).rejects.toThrow("มีผลประเมิน");
  });
  it("teacher finish grades only complete drafts in this session", async () => {
    db.assessmentAttempt.findMany.mockResolvedValue([{ attemptId: "full", formVersion: bank.version, draftAnswers: correct }, { attemptId: "partial", formVersion: bank.version, draftAnswers: { "pre-v1": 1 } }]);
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
    expect(db.assessmentAttempt.deleteMany).toHaveBeenCalledWith({ where: { classBookCycleId: "cycle", articleId: "article" } });
    expect(db.assessmentWindow.deleteMany).toHaveBeenCalledWith({ where: { classBookCycleId: "cycle", articleId: "article" } });
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
    db.assessmentAttempt.findMany.mockResolvedValue([{ studentUserId: "student", assessmentSessionId: "room", draftAnswers: { "pre-v1": 1 } }]);
    const state = await assessmentSnapshot(session);
    expect(state.progress[0]).toMatchObject({ name: "Student", answered: 1, completed: false });
    expect(state.answers).toEqual({});
  });
  it("retries database serialization conflicts", async () => {
    db.$transaction.mockRejectedValueOnce({ code: "P2034" });
    await saveAssessmentAnswer(session, "student", { revision: 2, questionId: "pre-v1", choice: 1 });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });
});
