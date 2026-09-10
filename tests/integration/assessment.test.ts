import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, seedStudent, seedTutor, seedClass } from "./setup";
import { assessmentSnapshot, controlAssessment, saveAssessmentAnswer } from "../../services/learning-service/src/services/LiveAssessmentService";
import type { LessonSession } from "../../services/learning-service/src/services/LessonSessionService";
import { randomUUID } from "node:crypto";
import answerKeys from "../../services/learning-service/src/services/assessment-answer-keys.v1.json";

const articleId = "The_New_Student";
const articleAnswers = answerKeys.articles[articleId];
const form = (stage: "PRE" | "POST") => Object.entries(articleAnswers.answers[stage]).map(([id, correct]) => ({ id, correct }));

// CI supplies a migrated, dedicated Postgres database through the existing
// integration configuration. Never point this suite at the application DB.
describe.skipIf(process.env.SKIP_INTEGRATION_TESTS === "1")("Assessment persistence and concurrency", () => {
  let tutorId: string;
  let studentId: string;
  let secondStudentId: string;
  let classId: string;
  let cycleId: string;
  let bookId: string;
  let createdBook = false;
  let createdSeries: string | undefined;
  let session: LessonSession;
  beforeAll(async () => {
    tutorId = await seedTutor(); studentId = await seedStudent(); secondStudentId = await seedStudent();
    let series = await prisma.series.findUnique({ where: { code: "PRIMARY-ORIGINS" } });
    if (!series) { series = await prisma.series.create({ data: { code: "PRIMARY-ORIGINS", name: "Primary Advantage Origins", cefrLevel: "A0", raLevelStart: 1, raLevelEnd: 3 } }); createdSeries = series.seriesId; }
    let book = await prisma.book.findUnique({ where: { bookCode: "Primary Origins 2" } });
    if (!book) { book = await prisma.book.create({ data: { seriesId: series.seriesId, bookCode: "Primary Origins 2", title: "Primary Origins 2", levelNumber: 20, articleCount: 14 } }); createdBook = true; }
    bookId = book.bookId;
    classId = await seedClass({ tutorUserId: tutorId, bookId });
    cycleId = (await prisma.classBookCycle.create({ data: { classId, bookId, sequence: 1 } })).classBookCycleId;
    await prisma.enrollment.createMany({ data: [studentId, secondStudentId].map(studentUserId => ({ classId, studentUserId, status: "ACTIVE" })) });
    const sessionId = randomUUID();
    await prisma.interactiveSession.create({ data: { sessionId, classId, bookId, classBookCycleId: cycleId, tutorUserId: tutorId, articleId, status: "ACTIVE" } });
    await prisma.activeLessonSessionLock.create({ data: { classId, sessionId, tutorUserId: tutorId } });
    session = { sessionId, articleId, classId, classBookCycleId: cycleId, tutorId, participants: new Map([studentId, secondStudentId].map(id => [id, { studentId: id, name: "Student", socketId: id, isReady: true }])) } as LessonSession;
  });
  afterAll(async () => {
    if (classId) {
      await prisma.enrollment.deleteMany({ where: { classId } });
      await prisma.class.delete({ where: { classId } });
    }
    await prisma.user.deleteMany({ where: { userId: { in: [tutorId, studentId, secondStudentId].filter(Boolean) } } });
    if (createdBook) await prisma.book.delete({ where: { bookId } });
    if (createdSeries) await prisma.series.delete({ where: { seriesId: createdSeries } });
  });
  it("only releases questions after teacher selection and start", async () => {
    await controlAssessment(session, { action: "select", mode: "PRE", revision: 0 });
    expect((await assessmentSnapshot(session, studentId)).items).toEqual([]);
    await controlAssessment(session, { action: "start", revision: 1 });
    expect((await assessmentSnapshot(session, studentId)).items).toHaveLength(15);
  });
  it("simultaneous answer writes merge without losing saved choices", async () => {
    await Promise.all(form("PRE").slice(0, 2).map(q => saveAssessmentAnswer(session, studentId, { revision: 2, questionId: q.id, choice: q.correct })));
    const state = await assessmentSnapshot(session, studentId);
    expect(Object.keys(state.answers)).toHaveLength(2);
    expect(state.completed).toBe(false);
    expect((await assessmentSnapshot(session, secondStudentId)).answers).toEqual({});
  });
  it("teacher finish grades complete drafts and leaves incomplete ones unscored", async () => {
    for (const q of form("PRE").slice(2)) await saveAssessmentAnswer(session, studentId, { revision: 2, questionId: q.id, choice: q.correct });
    await saveAssessmentAnswer(session, secondStudentId, { revision: 2, questionId: form("PRE")[0].id, choice: 0 });
    expect((await assessmentSnapshot(session, studentId)).completed).toBe(false);
    await controlAssessment(session, { action: "finish", revision: 2 });
    const full = await prisma.assessmentAttempt.findFirstOrThrow({ where: { classBookCycleId: cycleId, studentUserId: studentId, stage: "PRE" } });
    const partial = await prisma.assessmentAttempt.findFirstOrThrow({ where: { classBookCycleId: cycleId, studentUserId: secondStudentId, stage: "PRE" } });
    expect(full.total).toBe(15); expect(full.submittedAt).not.toBeNull();
    expect(partial.total).toBeNull(); expect(partial.submittedAt).toBeNull();
    await expect(saveAssessmentAnswer(session, secondStudentId, { revision: 2, questionId: form("PRE")[1].id, choice: 0 })).rejects.toThrow();
    expect((await assessmentSnapshot(session, studentId)).completed).toBe(true);
  });
  it("can return to Lesson in the same room and later start post without fabricating a baseline", async () => {
    await controlAssessment(session, { action: "select", mode: "LESSON", revision: 3 });
    expect((await assessmentSnapshot(session)).mode).toBe("LESSON");
    await controlAssessment(session, { action: "select", mode: "POST", revision: 4 });
    await controlAssessment(session, { action: "start", revision: 5 });
    for (const q of form("POST")) await saveAssessmentAnswer(session, secondStudentId, { revision: 6, questionId: q.id, choice: q.correct });
    await controlAssessment(session, { action: "finish", revision: 6 });
    const results = await prisma.assessmentAttempt.findMany({ where: { studentUserId: secondStudentId, classBookCycleId: cycleId, submittedAt: { not: null } } });
    expect(results).toHaveLength(1); expect(results[0].stage).toBe("POST"); expect(results[0].total).toBe(15);
    await expect(controlAssessment(session, { action: "select", mode: "PRE", revision: 7 })).rejects.toThrow();
  });
});
