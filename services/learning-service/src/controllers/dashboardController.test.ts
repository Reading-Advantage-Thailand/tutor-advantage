import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  class: { findMany: vi.fn() },
  enrollment: { groupBy: vi.fn() },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));
vi.mock("../services/ReadingAdvantageDB", () => ({
  getArticleDetails: vi.fn(),
}));

import { getDashboardSummary, redactArticleAnswers, sessionBelongsToBookCycle } from "./dashboardController";

describe("student article payloads", () => {
  it("removes answer keys from pre-class questions without mutating source data", () => {
    const source = {
      title: "A lesson",
      multipleChoiceQuestions: [
        { question: "Q", answer: "A", correctAnswer: "A", options: { a: "A" } },
      ],
      shortAnswerQuestions: [
        { question: "Explain", answer: "Because", correct_answer: "Because" },
      ],
    };

    const safe = redactArticleAnswers(source);
    expect(safe.multipleChoiceQuestions[0]).toEqual({ question: "Q", options: { a: "A" } });
    expect(safe.shortAnswerQuestions[0]).toEqual({ question: "Explain" });
    expect(source.multipleChoiceQuestions[0].answer).toBe("A");
  });
});

describe("legacy lesson progress", () => {
  const firstCycle = { classBookCycleId: "cycle-1", bookId: "book-1", sequence: 1 };
  const secondCycle = { classBookCycleId: "cycle-2", bookId: "book-2", sequence: 2 };

  it("maps sessions created before book-cycle fields existed to the first book", () => {
    expect(sessionBelongsToBookCycle({ classBookCycleId: null, bookId: null }, firstCycle)).toBe(true);
    expect(sessionBelongsToBookCycle({ classBookCycleId: null, bookId: null }, secondCycle)).toBe(false);
  });

  it("prefers explicit cycle and book identifiers when present", () => {
    expect(sessionBelongsToBookCycle({ classBookCycleId: "cycle-2", bookId: null }, secondCycle)).toBe(true);
    expect(sessionBelongsToBookCycle({ classBookCycleId: "cycle-2", bookId: null }, firstCycle)).toBe(false);
    expect(sessionBelongsToBookCycle({ classBookCycleId: null, bookId: "book-2" }, secondCycle)).toBe(true);
  });
});

describe("tutor dashboard classes needing setup", () => {
  const tutorId = "11111111-1111-4111-8111-111111111111";

  function tutorClass(overrides: Record<string, unknown>) {
    return {
      classId: "class-ready",
      title: "Ready class",
      status: "OPEN",
      enrolledCount: 0,
      scheduleDescription: null,
      scheduleData: null,
      setupRequiredAt: null,
      book: { title: "Reading 3.1" },
      ...overrides,
    };
  }

  function response() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  }

  beforeEach(() => {
    prisma.$queryRaw.mockResolvedValue([{ count: 0n }]);
    prisma.enrollment.groupBy.mockResolvedValue([]);
  });

  it("lists admin-created classes waiting for setup, oldest first, with paid students", async () => {
    prisma.class.findMany.mockResolvedValue([
      tutorClass({}),
      tutorClass({
        classId: "class-new",
        title: "English",
        enrolledCount: 3,
        setupRequiredAt: new Date("2026-11-02T05:00:00.000Z"),
        book: { title: "Primary Origins 2" },
      }),
      tutorClass({
        classId: "class-old",
        title: "Phonics",
        setupRequiredAt: new Date("2026-11-01T05:00:00.000Z"),
        book: null,
      }),
    ]);
    prisma.enrollment.groupBy.mockResolvedValue([{ classId: "class-new", _count: { _all: 2 } }]);
    const res = response();

    await getDashboardSummary({ id: "req-1", user: { userId: tutorId, role: "TUTOR" }, query: {} } as never, res as never);

    expect(prisma.enrollment.groupBy).toHaveBeenCalledWith({
      by: ["classId"],
      where: { classId: { in: ["class-old", "class-new"] }, status: "ACTIVE" },
      _count: { _all: true },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].classesNeedingSetup).toEqual([
      {
        classId: "class-old",
        title: "Phonics",
        bookTitle: null,
        activeStudents: 0,
        setupRequiredAt: "2026-11-01T05:00:00.000Z",
      },
      {
        classId: "class-new",
        title: "English",
        bookTitle: "Primary Origins 2",
        activeStudents: 2,
        setupRequiredAt: "2026-11-02T05:00:00.000Z",
      },
    ]);
  });

  it("returns an empty list without an extra query when every class is set up", async () => {
    prisma.class.findMany.mockResolvedValue([tutorClass({})]);
    const res = response();

    await getDashboardSummary({ id: "req-1", user: { userId: tutorId, role: "TUTOR" }, query: {} } as never, res as never);

    expect(prisma.enrollment.groupBy).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toMatchObject({ openClasses: 1, classesNeedingSetup: [] });
  });
});
