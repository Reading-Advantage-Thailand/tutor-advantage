import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  interactiveSession: {
    updateMany: vi.fn(),
  },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));
vi.mock("@tutor-advantage/shared-config", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { persistLiveSessionState } from "./SessionDBWriter";

describe("persistLiveSessionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.interactiveSession.updateMany.mockReturnValue({});
    prisma.$transaction.mockResolvedValue([{ count: 1 }]);
  });

  it("uses compare-and-swap versions for the room and active cycle mirror", async () => {
    prisma.$transaction.mockResolvedValue([{ count: 1 }, { count: 1 }]);

    await expect(persistLiveSessionState(
      "room-session",
      {
        currentPhase: 8,
        phaseVersion: 5,
        expectedPhaseVersion: 4,
        expectedMirrorPhaseVersion: 0,
      },
      "cycle-session",
    )).resolves.toBe(true);

    expect(prisma.interactiveSession.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { sessionId: "room-session", phaseVersion: 4 },
    }));
    expect(prisma.interactiveSession.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { sessionId: "cycle-session", phaseVersion: 0 },
    }));
  });

  it("reports a failed compare-and-swap without claiming the phase was saved", async () => {
    prisma.$transaction.mockResolvedValue([{ count: 0 }]);

    await expect(persistLiveSessionState(
      "room-session",
      {
        currentPhase: 8,
        phaseVersion: 5,
        expectedPhaseVersion: 4,
      },
    )).resolves.toBe(false);
  });

  it("fails closed when the database transaction errors", async () => {
    prisma.$transaction.mockRejectedValue(new Error("database unavailable"));

    await expect(persistLiveSessionState(
      "room-session",
      {
        currentPhase: 8,
        phaseVersion: 5,
        expectedPhaseVersion: 4,
      },
    )).resolves.toBe(false);
  });
});
