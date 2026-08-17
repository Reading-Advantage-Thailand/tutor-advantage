import { beforeEach, describe, expect, it, vi } from "vitest";
import { directEnroll } from "./enrollmentController";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  class: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  enrollment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  enrollmentPackage: {
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  classBookCycle: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function request(userId: string, role: string) {
  return {
    id: "req-1",
    user: { userId, role },
    body: { classId: "class-1" },
  };
}

describe("direct enrollment safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.class.findUnique.mockResolvedValue({
      classId: "class-1",
      tutorUserId: "tutor-1",
      status: "OPEN",
      enrolledCount: 0,
      capacity: 1,
      isDemo: false,
      expiresAt: null,
      packagePriceMinor: 250000n,
      freeHours: 0,
      bookId: "book-1",
    });
    prisma.enrollment.findMany.mockResolvedValue([]);
    prisma.enrollment.findFirst.mockResolvedValue(null);
    prisma.enrollment.updateMany.mockResolvedValue({ count: 0 });
    prisma.enrollmentPackage.updateMany.mockResolvedValue({ count: 0 });
    prisma.class.findMany.mockResolvedValue([]);
    prisma.class.update.mockImplementation(({ data }: { data: any }) =>
      Promise.resolve({
        classId: "class-1",
        tutorUserId: "tutor-1",
        status: "OPEN",
        enrolledCount: data.enrolledCount ?? 1,
        capacity: 1,
        isDemo: false,
        packagePriceMinor: 250000n,
        freeHours: 0,
        bookId: "book-1",
      }),
    );
    prisma.enrollment.create.mockResolvedValue({
      enrollmentId: "enrollment-1",
      classId: "class-1",
      studentUserId: "student-1",
      status: "PENDING_PAYMENT",
      paymentTransactionId: null,
    });
    prisma.classBookCycle.findFirst.mockResolvedValue({ classBookCycleId: "cycle-1" });
    prisma.enrollmentPackage.upsert.mockResolvedValue({});
  });

  it("rejects non-student accounts before reserving a seat", async () => {
    const res = response();

    await directEnroll(request("tutor-1", "TUTOR") as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "STUDENT_ROLE_REQUIRED" }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a student who tries to enroll in their own class", async () => {
    prisma.class.findUnique.mockResolvedValue({
      classId: "class-1",
      tutorUserId: "student-1",
      status: "OPEN",
      enrolledCount: 0,
      capacity: 1,
      isDemo: false,
      expiresAt: null,
      packagePriceMinor: 250000n,
      freeHours: 0,
      bookId: "book-1",
    });
    const res = response();

    await directEnroll(request("student-1", "STUDENT") as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "TUTOR_CANNOT_ENROLL_OWN_CLASS" }),
    });
    expect(prisma.enrollment.create).not.toHaveBeenCalled();
  });

  it("releases an expired unpaid seat before admitting the next student", async () => {
    prisma.class.findUnique.mockResolvedValue({
      classId: "class-1",
      tutorUserId: "tutor-1",
      status: "OPEN",
      enrolledCount: 1,
      capacity: 1,
      isDemo: false,
      expiresAt: null,
      packagePriceMinor: 250000n,
      freeHours: 0,
      bookId: "book-1",
    });
    prisma.enrollment.findMany.mockResolvedValue([{ enrollmentId: "expired-1" }]);
    prisma.enrollment.updateMany.mockResolvedValue({ count: 1 });
    const res = response();

    await directEnroll(request("student-1", "STUDENT") as never, res as never);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.enrollment.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: { in: ["expired-1"] }, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED", paymentExpiresAt: null },
    });
    expect(prisma.enrollmentPackage.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: { in: ["expired-1"] }, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
