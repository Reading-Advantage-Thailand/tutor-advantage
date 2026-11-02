import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    enrollment: { findFirst: vi.fn() },
    class: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    conversation: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    conversationParticipant: { upsert: vi.fn() },
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(function PrismaClient() {
    return mockPrisma;
  }),
}));

vi.mock("../services/LineNotificationService", () => ({
  LineNotificationService: { buildLiffDeepLink: vi.fn(), sendToUser: vi.fn() },
}));

import { initiateChat } from "./chatController";

const OWN_CLASS = "11111111-1111-4111-8111-111111111111";
const OTHER_CLASS = "22222222-2222-4222-8222-222222222222";
const TUTOR = "33333333-3333-4333-8333-333333333333";
const STUDENT = "44444444-4444-4444-8444-444444444444";

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function expectNoDatabaseAccess() {
  expect(mockPrisma.enrollment.findFirst).not.toHaveBeenCalled();
  expect(mockPrisma.class.findFirst).not.toHaveBeenCalled();
  expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  expect(mockPrisma.conversation.findFirst).not.toHaveBeenCalled();
  expect(mockPrisma.conversationParticipant.upsert).not.toHaveBeenCalled();
}

describe("initiateChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["an `in` filter", { in: [OWN_CLASS, OTHER_CLASS] }],
    ["a `not` filter", { not: OWN_CLASS }],
    ["a `notIn` filter", { notIn: [OWN_CLASS] }],
    ["an array", [OTHER_CLASS]],
    ["a non-UUID string", "class-1"],
  ])("rejects a group classId given as %s before touching the database", async (_label, classId) => {
    const req = { user: { userId: TUTOR, role: "TUTOR" }, body: { type: "GROUP", classId } };
    const res = createResponse();

    await initiateChat(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expectNoDatabaseAccess();
  });

  it("rejects a direct targetUserId given as a filter object", async () => {
    const req = {
      user: { userId: STUDENT, role: "STUDENT" },
      body: { type: "DIRECT", targetUserId: { not: STUDENT } },
    };
    const res = createResponse();

    await initiateChat(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expectNoDatabaseAccess();
  });

  it("lets a tutor open the group chat of their own class", async () => {
    mockPrisma.class.findFirst.mockResolvedValue({ classId: OWN_CLASS });
    mockPrisma.conversation.findFirst.mockResolvedValue({ conversationId: "conv-own" });
    mockPrisma.conversationParticipant.upsert.mockResolvedValue({});
    const req = { user: { userId: TUTOR, role: "TUTOR" }, body: { type: "GROUP", classId: OWN_CLASS } };
    const res = createResponse();

    await initiateChat(req as never, res as never);

    expect(mockPrisma.class.findFirst).toHaveBeenCalledWith({
      where: { classId: OWN_CLASS, tutorUserId: TUTOR },
      select: { classId: true },
    });
    expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { classId: OWN_CLASS, type: "GROUP" },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ conversationId: "conv-own" });
  });

  it("refuses a student who is not actively enrolled in the class", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue(null);
    const req = { user: { userId: STUDENT, role: "STUDENT" }, body: { type: "GROUP", classId: OTHER_CLASS } };
    const res = createResponse();

    await initiateChat(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockPrisma.conversation.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.conversationParticipant.upsert).not.toHaveBeenCalled();
  });
});
