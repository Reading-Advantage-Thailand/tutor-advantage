import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  conversationParticipant: { findMany: vi.fn() },
  message: { count: vi.fn() },
  classTransferRequest: { count: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));
vi.mock("@tutor-advantage/shared-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tutor-advantage/shared-config")>()),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getNotificationSummary } from "./notificationsController";

const USER = "11111111-1111-4111-8111-111111111111";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.conversationParticipant.findMany.mockResolvedValue([{ conversationId: "c1", lastReadAt: null }]);
  prisma.message.count.mockResolvedValue(2);
  prisma.classTransferRequest.count.mockResolvedValue(1);
});

describe("GET /v1/notifications/summary", () => {
  it("adds supportUpdates for the caller's tickets", async () => {
    prisma.$queryRaw.mockResolvedValue([{ count: 3 }]);
    const res = response();
    await getNotificationSummary({ id: "r", user: { userId: USER, role: "STUDENT" } } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ notifications: { unreadChat: 2, availableAuctions: 1, supportUpdates: 3 } });
    expect(prisma.$queryRaw.mock.calls[0]).toContain(USER);
  });

  it("falls back to 0 support updates when that count fails", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("relation does not exist"));
    const res = response();
    await getNotificationSummary({ id: "r", user: { userId: USER, role: "TUTOR" } } as never, res as never);
    expect(res.json).toHaveBeenCalledWith({ notifications: { unreadChat: 2, availableAuctions: 1, supportUpdates: 0 } });
  });
});
