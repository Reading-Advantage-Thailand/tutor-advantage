import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import path from "node:path";
import { createOpenApiMiddleware, openApiValidationErrorHandler } from "@tutor-advantage/shared-config";

const { db } = vi.hoisted(() => ({ db: {
  classBookCycle: { findUnique: vi.fn() }, enrollment: { findFirst: vi.fn(), findMany: vi.fn() },
  article: { findMany: vi.fn() }, assessmentWindow: { findMany: vi.fn(), upsert: vi.fn() },
  assessmentAttempt: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  user: { findMany: vi.fn() }, $transaction: vi.fn(),
} }));
vi.mock("@tutor-advantage/database", async importOriginal => ({ ...await importOriginal<typeof import("@tutor-advantage/database")>(), prisma: db }));
import { getAssessment, startAssessment, submitAssessment, getAssessmentReport, openPostAssessment, commentAssessment } from "./assessmentController";
const cycleId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";
const tutorId = "44444444-4444-4444-8444-444444444444";
const root = `/v1/book-cycles/${cycleId}/assessment`;
const answers = Object.fromEntries(Array.from({ length: 15 }, (_, index) => [`pre-${index + 1}`, 0]));
const cycle = { classBookCycleId: cycleId, classId: "class", sequence: 1, bookId: "book", book: { title: "Primary Origins 2", bookCode: "Primary Origins 2", levelNumber: 20, series: { code: "PRIMARY-ORIGINS" } }, class: { bookId: "book", tutorUserId: tutorId, isDemo: false } };
const attempt = { attemptId, articleId: "The_New_Student", studentUserId: studentId, stage: "PRE", formVersion: "article-assessments-v1-test", startedAt: new Date(), submittedAt: null, scores: null, total: null, teacherComment: null, commentedAt: null };
const app = express();
app.use(express.json());
app.use(createOpenApiMiddleware(path.resolve("packages/contracts/openapi/learning.v1.yaml")));
app.use((req, _res, next) => {
  const role = req.header("x-test-role") || "STUDENT";
  if (role !== "ANONYMOUS") Object.assign(req, { user: { role, userId: role === "TUTOR" ? tutorId : studentId } });
  next();
});
app.get("/v1/book-cycles/:cycleId/assessment", getAssessment);
app.post("/v1/book-cycles/:cycleId/assessment/start", startAssessment);
app.post("/v1/book-cycles/:cycleId/assessment/submit", submitAssessment);
app.get("/v1/book-cycles/:cycleId/assessment/report", getAssessmentReport);
app.post("/v1/book-cycles/:cycleId/assessment/open-post", openPostAssessment);
app.patch("/v1/book-cycles/:cycleId/assessment/attempts/:attemptId/comment", commentAssessment);
app.use(openApiValidationErrorHandler);

describe("Origins 2 assessment HTTP contracts and access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.classBookCycle.findUnique.mockResolvedValue(cycle);
    db.enrollment.findFirst.mockResolvedValue({ packageAccess: [] });
    db.enrollment.findMany.mockResolvedValue([{ studentUserId: studentId, packageAccess: [] }]);
    db.article.findMany.mockResolvedValue([{ articleId: "The_New_Student", title: "The New Student" }]);
    db.assessmentWindow.findMany.mockResolvedValue([]);
    db.assessmentAttempt.findMany.mockResolvedValue([]);
    db.assessmentAttempt.findUnique.mockResolvedValue(attempt);
    db.assessmentAttempt.upsert.mockResolvedValue(attempt);
    db.assessmentAttempt.update.mockImplementation(({ data }) => Promise.resolve({ ...attempt, ...data }));
    db.$transaction.mockImplementation(fn => fn(db));
  });
  it("requires login", async () => {
    await request(app).get(root).set("x-test-role", "ANONYMOUS").expect(401);
    expect(db.classBookCycle.findUnique).not.toHaveBeenCalled();
  });
  it("rejects malformed cycle ids before querying", async () => {
    await request(app).get(root.replace(cycleId, "not-a-uuid")).expect(400);
    expect(db.classBookCycle.findUnique).not.toHaveBeenCalled();
  });
  it("rejects students without active enrollment", async () => {
    db.enrollment.findFirst.mockResolvedValue(null);
    await request(app).post(root + "/start").send({ stage: "PRE" }).expect(403);
    expect(db.assessmentAttempt.upsert).not.toHaveBeenCalled();
  });
  it("does not let original-book fallback bypass revoked package access", async () => {
    db.enrollment.findFirst.mockResolvedValue({ packageAccess: [{ classBookCycleId: cycleId, status: "REVOKED" }] });
    await request(app).get(root).expect(403);
  });
  it("requires paid access for subsequent cycles", async () => {
    db.classBookCycle.findUnique.mockResolvedValue({ ...cycle, sequence: 2 });
    await request(app).get(root).expect(403);
    db.enrollment.findFirst.mockResolvedValue({ packageAccess: [{ classBookCycleId: cycleId, status: "ACTIVE" }] });
    await request(app).get(root).expect(200);
  });
  it("supports every catalog book that has article assessment data", async () => {
    db.classBookCycle.findUnique.mockResolvedValue({ ...cycle, book: { ...cycle.book, bookCode: "Primary 2" } });
    expect((await request(app).get(root).expect(200)).body.supported).toBe(true);
    await request(app).post(root + "/start").send({ stage: "PRE" }).expect(409);
  });
  it("hides assessment controls when no article bank exists for the book", async () => {
    db.article.findMany.mockResolvedValue([{ articleId: "not-in-bank", title: "Missing" }]);
    expect((await request(app).get(root).expect(200)).body.supported).toBe(false);
    await request(app).post(root + "/start").send({ stage: "PRE" }).expect(404);
  });
  it("blocks all retired self-service mutations", async () => {
    await request(app).post(root + "/start").send({ stage: "PRE" }).expect(409);
    await request(app).post(root + "/submit").send({ stage: "PRE", answers }).expect(409);
    await request(app).post(root + "/open-post").set("x-test-role", "TUTOR").expect(409);
    expect(db.assessmentAttempt.upsert).not.toHaveBeenCalled();
    expect(db.assessmentAttempt.update).not.toHaveBeenCalled();
    expect(db.assessmentWindow.upsert).not.toHaveBeenCalled();
  });
  it("rejects student and unrelated tutor access to reporting and opening", async () => {
    await request(app).get(root + "/report").expect(403);
    await request(app).post(root + "/open-post").expect(403);
    db.classBookCycle.findUnique.mockResolvedValue({ ...cycle, class: { ...cycle.class, tutorUserId: "other" } });
    await request(app).get(root + "/report").set("x-test-role", "TUTOR").expect(403);
    await request(app).post(root + "/open-post").set("x-test-role", "TUTOR").expect(403);
  });
  it("includes enrolled students with no attempts in the teacher report", async () => {
    db.user.findMany.mockResolvedValue([{ userId: studentId, displayName: "Student" }]);
    const result = await request(app).get(root + "/report").set("x-test-role", "TUTOR").expect(200);
    expect(result.body.students[0].attempts).toEqual([]);
  });
  it("scopes teacher comments to submitted attempts in the owned cycle", async () => {
    db.assessmentAttempt.updateMany.mockResolvedValue({ count: 1 });
    await request(app).patch(root + `/attempts/${attemptId}/comment`).set("x-test-role", "TUTOR").send({ comment: "  ฝึกฟังต่อ  " }).expect(200);
    expect(db.assessmentAttempt.updateMany.mock.calls[0][0]).toMatchObject({ where: { classBookCycleId: cycleId, attemptId, submittedAt: { not: null } }, data: { teacherComment: "ฝึกฟังต่อ", commentedBy: tutorId } });
    db.assessmentAttempt.updateMany.mockResolvedValue({ count: 0 });
    await request(app).patch(root + `/attempts/${attemptId}/comment`).set("x-test-role", "TUTOR").send({ comment: "hello" }).expect(404);
    await request(app).patch(root + `/attempts/${attemptId}/comment`).send({ comment: "hello" }).expect(403);
  });
});
