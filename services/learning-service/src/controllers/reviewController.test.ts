import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    class: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(function PrismaClient() {
    return mockPrisma;
  }),
}));

import { getMyTutorReviewForClass, submitTutorReview } from "./reviewController";

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe("reviewController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("rejects review submissions without an authenticated student", async () => {
    const req = {
      params: { classId: "class-1" },
      body: { rating: 5 },
    };
    const res = createResponse();

    await submitTutorReview(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockPrisma.class.findUnique).not.toHaveBeenCalled();
  });

  it("rejects ratings outside the 1 to 5 integer range", async () => {
    const req = {
      user: { userId: "student-1" },
      params: { classId: "class-1" },
      body: { rating: 6 },
    };
    const res = createResponse();

    await submitTutorReview(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.class.findUnique).not.toHaveBeenCalled();
  });

  it("upserts an enrolled student's review and trims comments", async () => {
    mockPrisma.class.findUnique.mockResolvedValue({
      classId: "class-1",
      tutorUserId: "tutor-1",
      status: "ACTIVE",
      enrollments: [{ enrollmentId: "enrollment-1" }],
    });
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        reviewId: "review-1",
        tutorUserId: "tutor-1",
        studentUserId: "student-1",
        classId: "class-1",
        rating: 4,
        comment: "clear lesson",
        createdAt: new Date("2026-05-22T10:00:00.000Z"),
        updatedAt: new Date("2026-05-22T10:05:00.000Z"),
      },
    ]);
    const req = {
      user: { userId: "student-1" },
      params: { classId: "class-1" },
      body: { rating: 4, comment: "  clear lesson  " },
    };
    const res = createResponse();

    await submitTutorReview(req as never, res as never);

    expect(mockPrisma.class.findUnique).toHaveBeenCalledWith({
      where: { classId: "class-1" },
      select: expect.objectContaining({
        classId: true,
        tutorUserId: true,
        enrollments: expect.any(Object),
      }),
    });
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      review: expect.objectContaining({
        id: "review-1",
        rating: 4,
        comment: "clear lesson",
        createdAt: "2026-05-22T10:00:00.000Z",
        updatedAt: "2026-05-22T10:05:00.000Z",
      }),
    });
  });

  it("blocks students who are not actively enrolled in the class", async () => {
    mockPrisma.class.findUnique.mockResolvedValue({
      classId: "class-1",
      tutorUserId: "tutor-1",
      status: "ACTIVE",
      enrollments: [],
    });
    const req = {
      user: { userId: "student-1" },
      params: { classId: "class-1" },
      body: { rating: 5 },
    };
    const res = createResponse();

    await submitTutorReview(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns the current student's existing review or null", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);
    const emptyRes = createResponse();

    await getMyTutorReviewForClass(
      { user: { userId: "student-1" }, params: { classId: "class-1" } } as never,
      emptyRes as never,
    );

    expect(emptyRes.status).toHaveBeenCalledWith(200);
    expect(emptyRes.json).toHaveBeenCalledWith({ review: null });

    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        reviewId: "review-2",
        tutorUserId: "tutor-1",
        studentUserId: "student-1",
        classId: "class-1",
        rating: 5,
        comment: null,
        createdAt: new Date("2026-05-22T11:00:00.000Z"),
        updatedAt: new Date("2026-05-22T11:00:00.000Z"),
      },
    ]);
    const res = createResponse();

    await getMyTutorReviewForClass(
      { user: { userId: "student-1" }, params: { classId: "class-1" } } as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      review: expect.objectContaining({
        id: "review-2",
        rating: 5,
        comment: null,
      }),
    });
  });
});
