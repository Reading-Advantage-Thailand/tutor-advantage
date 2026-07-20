import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, updateSettings } from "./settingController";

const prisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  oAuthIdentity: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function request(body: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    user: { userId: "student-1", role: "STUDENT" },
    body,
  };
}

describe("student notification settings", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset();
    prisma.user.update.mockReset();
    prisma.oAuthIdentity.findFirst.mockReset();
  });

  it("returns whether the student has a linked LINE identity", async () => {
    prisma.user.findUnique.mockResolvedValue({
      settings: { notifications: { notifyClassReminders: false } },
    });
    prisma.oAuthIdentity.findFirst.mockResolvedValue({ identityId: "line-1" });
    const res = response();

    await getSettings(request() as never, res as never);

    expect(prisma.oAuthIdentity.findFirst).toHaveBeenCalledWith({
      where: { userId: "student-1", provider: "line" },
      select: { identityId: true },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      settings: { notifications: { notifyClassReminders: false } },
      lineConnected: true,
    });
  });

  it("preserves notification keys omitted by a partial update", async () => {
    prisma.user.findUnique.mockResolvedValue({
      settings: {
        theme: "dark",
        notifications: {
          notifyClassReminders: true,
          notifyLineMessages: true,
        },
      },
    });
    prisma.user.update.mockResolvedValue({
      settings: {
        theme: "dark",
        notifications: {
          notifyClassReminders: false,
          notifyLineMessages: true,
        },
      },
    });
    const res = response();

    await updateSettings(
      request({ notifications: { notifyClassReminders: false } }) as never,
      res as never,
    );

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "student-1" },
      data: {
        settings: {
          theme: "dark",
          notifications: {
            notifyClassReminders: false,
            notifyLineMessages: true,
          },
        },
      },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
