import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  interactiveSession: {
    updateMany: vi.fn(),
  },
  activeLessonSessionLock: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  sessionParticipant: { upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  sessionAnswer: { findUnique: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));
vi.mock("@tutor-advantage/shared-config", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  ACTIVE_SESSION_LOCK_STALE_MS,
  UNRESTORABLE_LOCK_STALE_MS,
  claimActiveSession,
  markParticipantRemoved,
  persistAnswer,
  persistLiveSessionState,
  persistSessionParticipant,
} from "./SessionDBWriter";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SESSION_ID = "33333333-3333-4333-8333-333333333333";
const TUTOR_ID = "44444444-4444-4444-8444-444444444444";
const STUDENT_ID = "55555555-5555-4555-8555-555555555555";

describe("claimActiveSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.activeLessonSessionLock.create.mockRejectedValueOnce(new Error("unique"));
  });

  it("keeps a recent lock so a returning tutor rehydrates the lesson instead of starting over", async () => {
    prisma.activeLessonSessionLock.findUnique.mockResolvedValue({
      sessionId: OTHER_SESSION_ID,
      lastHeartbeatAt: new Date(Date.now() - 5 * 60_000),
    });

    await expect(claimActiveSession(CLASS_ID, SESSION_ID, TUTOR_ID)).resolves.toEqual({
      acquired: false,
      existingSessionId: OTHER_SESSION_ID,
    });
    expect(prisma.activeLessonSessionLock.deleteMany).not.toHaveBeenCalled();
  });

  it("frees a lock left over from a crash", async () => {
    prisma.activeLessonSessionLock.findUnique.mockResolvedValue({
      sessionId: OTHER_SESSION_ID,
      lastHeartbeatAt: new Date(Date.now() - ACTIVE_SESSION_LOCK_STALE_MS - 1_000),
    });
    prisma.activeLessonSessionLock.deleteMany.mockResolvedValue({ count: 1 });
    prisma.activeLessonSessionLock.create.mockResolvedValueOnce({});

    await expect(claimActiveSession(CLASS_ID, SESSION_ID, TUTOR_ID)).resolves.toEqual({ acquired: true });
  });

  it("frees a lock sooner when its room cannot be restored", async () => {
    prisma.activeLessonSessionLock.findUnique.mockResolvedValue({
      sessionId: OTHER_SESSION_ID,
      lastHeartbeatAt: new Date(Date.now() - UNRESTORABLE_LOCK_STALE_MS - 1_000),
    });
    prisma.activeLessonSessionLock.deleteMany.mockResolvedValue({ count: 1 });
    prisma.activeLessonSessionLock.create.mockResolvedValueOnce({});

    await expect(
      claimActiveSession(CLASS_ID, SESSION_ID, TUTOR_ID, UNRESTORABLE_LOCK_STALE_MS),
    ).resolves.toEqual({ acquired: true });
  });
});

describe("removed students", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ userId: STUDENT_ID });
    prisma.sessionParticipant.upsert.mockResolvedValue({});
    prisma.sessionParticipant.updateMany.mockResolvedValue({ count: 2 });
  });

  it("marks the student removed in the room and its current round", async () => {
    await markParticipantRemoved([OTHER_SESSION_ID, SESSION_ID, undefined, SESSION_ID], STUDENT_ID);

    expect(prisma.sessionParticipant.updateMany).toHaveBeenCalledWith({
      where: { sessionId: { in: [OTHER_SESSION_ID, SESSION_ID] }, studentUserId: STUDENT_ID },
      data: { removedAt: expect.any(Date) },
    });
  });

  it("clears the removal when the student joins again", async () => {
    await persistSessionParticipant(SESSION_ID, STUDENT_ID);

    expect(prisma.sessionParticipant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { removedAt: null },
    }));
  });
});

describe("persistAnswer", () => {
  const answer = { sessionId: SESSION_ID, studentId: STUDENT_ID, phase: 10, answerText: "{}", isCorrect: null };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ userId: STUDENT_ID });
    prisma.sessionParticipant.upsert.mockResolvedValue({});
    prisma.sessionParticipant.update.mockResolvedValue({});
    prisma.sessionAnswer.upsert.mockResolvedValue({});
  });

  it("adds the score of a first answer to the tally", async () => {
    prisma.sessionAnswer.findUnique.mockResolvedValue(null);

    await persistAnswer({ ...answer, score: 8 });

    expect(prisma.sessionAnswer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ score: 8, phase: 10 }),
    }));
    expect(prisma.sessionParticipant.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { score: { increment: 8 } },
    }));
  });

  it("replaces a replayed phase and moves the tally by the difference", async () => {
    prisma.sessionAnswer.findUnique.mockResolvedValue({ score: 8 });

    await persistAnswer({ ...answer, score: 3 });

    expect(prisma.sessionAnswer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ score: 3 }),
    }));
    expect(prisma.sessionParticipant.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { score: { increment: -5 } },
    }));
  });
});

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
      where: { sessionId: "room-session", phaseVersion: 4, assessmentMode: "LESSON" },
    }));
    expect(prisma.interactiveSession.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { sessionId: "cycle-session", phaseVersion: 0, assessmentMode: "LESSON" },
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
