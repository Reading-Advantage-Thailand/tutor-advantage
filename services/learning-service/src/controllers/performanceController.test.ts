import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tutorPerformance: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    sessionAnswer: { count: vi.fn() },
    message: { findMany: vi.fn() },
    class: { findMany: vi.fn() },
    enrollment: { count: vi.fn() },
    interactiveSession: { count: vi.fn() },
    tutorBadge: { findMany: vi.fn() },
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(function PrismaClient() {
    return mockPrisma;
  }),
}));

import { getPerformanceSummary } from "./performanceController";

const decimal = (value: number) => ({
  toNumber: () => value,
});

const createResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

const createRequest = () => ({
  user: { userId: "tutor-1" },
});

const setupBaseMocks = () => {
  mockPrisma.class.findMany.mockResolvedValue([]);
  mockPrisma.message.findMany.mockResolvedValue([]);
  mockPrisma.$queryRaw.mockResolvedValue([{ average: null, total: 0 }]);
  mockPrisma.enrollment.count.mockResolvedValue(0);
  mockPrisma.interactiveSession.count.mockResolvedValue(0);
  mockPrisma.tutorBadge.findMany.mockResolvedValue([]);
};

describe("getPerformanceSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBaseMocks();
  });

  it("returns unavailable metrics for a tutor without snapshots or answered questions", async () => {
    mockPrisma.tutorPerformance.findMany.mockResolvedValue([]);
    mockPrisma.sessionAnswer.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const res = createResponse();
    await getPerformanceSummary(createRequest() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.metrics.engagement.rating).toEqual({
      value: null,
      source: "unavailable",
      sampleSize: 0,
    });
    expect(body.metrics.engagement.responseTimeMinutes).toEqual({
      value: null,
      source: "unavailable",
      sampleSize: 0,
    });
    expect(body.metrics.studentBenchmark).toMatchObject({
      current: null,
      value: null,
      source: "unavailable",
      sampleSize: 0,
      correctAnswers: null,
      totalAnswers: null,
    });
    expect(body.badges.nextGoal).toBeNull();
  });

  it("marks snapshot-only metrics as historical", async () => {
    mockPrisma.tutorPerformance.findMany.mockResolvedValue([
      {
        avgResponseTime: 12,
        overallRating: decimal(4.7),
        studentScoreAvg: decimal(82),
      },
    ]);
    mockPrisma.sessionAnswer.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const res = createResponse();
    await getPerformanceSummary(createRequest() as never, res as never);

    const body = res.json.mock.calls[0][0];
    expect(body.metrics.engagement.rating).toEqual({
      value: 4.7,
      source: "historical",
      sampleSize: 1,
    });
    expect(body.metrics.engagement.responseTimeMinutes).toEqual({
      value: 12,
      source: "historical",
      sampleSize: 1,
    });
    expect(body.metrics.studentBenchmark).toMatchObject({
      current: 82,
      value: 82,
      source: "historical",
      sampleSize: 1,
      correctAnswers: null,
      totalAnswers: null,
    });
  });

  it("uses answered interactive questions for student success when available", async () => {
    mockPrisma.tutorPerformance.findMany.mockResolvedValue([
      {
        avgResponseTime: null,
        overallRating: null,
        studentScoreAvg: decimal(55),
      },
    ]);
    mockPrisma.sessionAnswer.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(6);
    mockPrisma.interactiveSession.count.mockResolvedValue(3);

    const res = createResponse();
    await getPerformanceSummary(createRequest() as never, res as never);

    const body = res.json.mock.calls[0][0];
    expect(body.metrics.studentBenchmark).toMatchObject({
      current: 75,
      value: 75,
      source: "actual",
      sampleSize: 8,
      correctAnswers: 6,
      totalAnswers: 8,
    });
    expect(body.metrics.activity).toMatchObject({
      interactiveSessions: 3,
      answers: {
        total: 8,
        correct: 6,
      },
    });
  });

  it("calculates actual response time from student messages followed by tutor replies", async () => {
    mockPrisma.tutorPerformance.findMany.mockResolvedValue([
      {
        avgResponseTime: 30,
        overallRating: null,
        studentScoreAvg: null,
      },
    ]);
    mockPrisma.message.findMany.mockResolvedValue([
      {
        conversationId: "conversation-1",
        senderId: "student-1",
        createdAt: new Date("2026-05-22T10:00:00.000Z"),
      },
      {
        conversationId: "conversation-1",
        senderId: "student-1",
        createdAt: new Date("2026-05-22T10:03:00.000Z"),
      },
      {
        conversationId: "conversation-1",
        senderId: "tutor-1",
        createdAt: new Date("2026-05-22T10:10:00.000Z"),
      },
      {
        conversationId: "conversation-2",
        senderId: "student-2",
        createdAt: new Date("2026-05-22T11:00:00.000Z"),
      },
      {
        conversationId: "conversation-2",
        senderId: "tutor-1",
        createdAt: new Date("2026-05-22T11:20:00.000Z"),
      },
    ]);
    mockPrisma.sessionAnswer.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const res = createResponse();
    await getPerformanceSummary(createRequest() as never, res as never);

    const body = res.json.mock.calls[0][0];
    expect(body.metrics.engagement.responseTimeMinutes).toEqual({
      value: 15,
      source: "actual",
      sampleSize: 2,
    });
  });

  it("uses actual tutor reviews for average rating when available", async () => {
    mockPrisma.tutorPerformance.findMany.mockResolvedValue([
      {
        avgResponseTime: null,
        overallRating: decimal(4.1),
        studentScoreAvg: null,
      },
    ]);
    mockPrisma.$queryRaw.mockResolvedValue([{ average: 4.6666666667, total: 3 }]);
    mockPrisma.sessionAnswer.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const res = createResponse();
    await getPerformanceSummary(createRequest() as never, res as never);

    const body = res.json.mock.calls[0][0];
    expect(body.metrics.engagement.rating).toEqual({
      value: 4.7,
      source: "actual",
      sampleSize: 3,
    });
    expect(body.metrics.activity.reviews).toEqual({
      total: 3,
      average: 4.6666666667,
    });
  });
});
