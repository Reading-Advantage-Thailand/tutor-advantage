import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import path from "node:path";
import { createOpenApiMiddleware, openApiValidationErrorHandler } from "@tutor-advantage/shared-config";

const db = vi.hoisted(() => ({
  class: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  user: { findMany: vi.fn() },
  classBookCycle: { create: vi.fn() },
}));
vi.mock("@tutor-advantage/database", () => ({ prisma: db }));
import { getPublicClass, getPublicClasses, projectPublicClass, publicClassSelect, publicClassWhere } from "./publicClassController";

const id = "12345678-1234-4234-8234-123456789abc";
const bookId = "33333333-3333-4333-8333-333333333333";
const record = () => ({
  classId: id, title: "English group", bookId, tutorUserId: "tutor1",
  capacity: 5, enrolledCount: 5, packagePriceMinor: 300000n,
  scheduleDescription: "วันเสาร์ 10:00-12:00", startsAt: null, endsAt: null,
  book: { bookCode: "Reading 3.1", title: "Reading 3.1", articleCount: 14, series: { cefrLevel: "A1" }, articles: [{ title: "The Library Map" }] },
  bookCycles: [
    { bookId, sequence: 1, packagePriceMinor: 320000n },
    { bookId: "book2", sequence: 2, packagePriceMinor: 470000n },
  ],
});
function response() { return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }; }

describe("public sales catalogue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T00:00:00Z"));
    vi.clearAllMocks();
    db.class.findMany.mockResolvedValue([record()]);
    db.class.findFirst.mockResolvedValue(record());
    db.user.findMany.mockResolvedValue([{ userId: "tutor1", displayName: "Teacher" }]);
  });
  afterEach(() => vi.useRealTimers());
  it("serves anonymous HTTP requests with a response matching the public contract", async () => {
    vi.useRealTimers();
    const app = express();
    app.use(createOpenApiMiddleware(path.resolve("packages/contracts/openapi/learning.v1.yaml")));
    app.get("/v1/public/classes", getPublicClasses);
    app.get("/v1/public/classes/:classId", getPublicClass);
    app.use(openApiValidationErrorHandler);
    const list = await request(app).get("/v1/public/classes").expect(200);
    expect(list.body.classes[0].packagePriceSatang).toBe(320000);
    await request(app).get("/v1/public/classes/" + id).expect(200);
    await request(app).get("/v1/public/classes/invalid").expect(404);
  });
  it("queries only paid OPEN, non-demo, unexpired classes", async () => {
    const now = new Date("2026-10-22T00:00:00Z");
    expect(publicClassWhere(now)).toEqual({ status: "OPEN", isDemo: false, packagePriceMinor: { gt: 0 }, AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: new Date("2026-10-21T17:00:00Z") } }] },
    ] });
    const res = response();
    await getPublicClasses({} as never, res as never);
    expect(db.class.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: publicClassWhere(), select: publicClassSelect }));
    const course = res.json.mock.calls[0][0].classes[0];
    expect(course).toMatchObject({ packagePriceSatang: 320000, full: true, currency: "THB" });
    expect(Object.keys(course).sort()).toEqual(["id", "name", "bookId", "bookCode", "book", "program", "cefr", "articleCount", "lessonTitles", "tutor", "packagePriceSatang", "currency", "schedule", "startsAt", "endsAt", "full"].sort());
    expect(publicClassSelect.book.select.articles.select).toEqual({ title: true });
    expect(publicClassSelect).not.toHaveProperty("enrollments");
    expect(publicClassSelect).not.toHaveProperty("meetingUrl");
    expect(publicClassSelect).not.toHaveProperty("referrals");
    expect(db.class.create).not.toHaveBeenCalled();
    expect(db.class.update).not.toHaveBeenCalled();
    expect(db.classBookCycle.create).not.toHaveBeenCalled();
  });
  it("uses class price without creating an absent cycle and recognises Primary", () => {
    const cls = record(); cls.bookCycles = []; cls.book.bookCode = "Primary Origins 2";
    expect(projectPublicClass(cls, null)).toMatchObject({ program: "Primary Advantage", packagePriceSatang: 300000, tutor: null });
    expect(db.classBookCycle.create).not.toHaveBeenCalled();
  });
  it("returns 404 for hidden courses and invalid IDs without disclosing existence", async () => {
    const res = response();
    await getPublicClass({ params: { classId: "bad-id" } } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(db.class.findFirst).not.toHaveBeenCalled();
    db.class.findFirst.mockResolvedValue(null);
    await getPublicClass({ params: { classId: id } } as never, res as never);
    expect(db.class.findFirst).toHaveBeenCalledWith({ where: { ...publicClassWhere(), classId: id }, select: publicClassSelect });
    expect(res.status).toHaveBeenLastCalledWith(404);
  });
  it("does not advertise a free original cycle even if the class fallback is paid", async () => {
    const cls = record(); cls.bookCycles[0].packagePriceMinor = 0n;
    db.class.findMany.mockResolvedValue([cls]);
    db.class.findFirst.mockResolvedValue(cls);
    const res = response();
    await getPublicClasses({} as never, res as never);
    expect(res.json).toHaveBeenCalledWith({ classes: [] });
    await getPublicClass({ params: { classId: id } } as never, res as never);
    expect(res.status).toHaveBeenLastCalledWith(404);
  });
  it("reports an outage rather than inventing courses or prices", async () => {
    db.class.findMany.mockRejectedValue(new Error("offline"));
    const res = response();
    await getPublicClasses({} as never, res as never);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: { code: "CATALOG_UNAVAILABLE", message: "Course catalogue unavailable" } });
  });
});
