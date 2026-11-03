import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, realtime } = vi.hoisted(() => {
  const prisma = {
    aiVoiceSession: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    activeAiVoiceSession: { updateMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (work: (tx: typeof prisma) => unknown) => work(prisma));
  return {
    prisma,
    realtime: { connections: [] as Array<{ emit: (event: Record<string, unknown>) => void }> },
  };
});

vi.mock("@tutor-advantage/database", () => ({
  prisma,
  Prisma: {
    TransactionIsolationLevel: { Serializable: "Serializable" },
    PrismaClientKnownRequestError: class extends Error {},
    JsonNull: null,
  },
}));
vi.mock("@tutor-advantage/shared-config", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("openai", () => ({ default: vi.fn(function OpenAI() { return {}; }) }));
vi.mock("openai/realtime/ws", () => ({
  OpenAIRealtimeWS: vi.fn(function OpenAIRealtimeWS() {
    const listeners: Record<string, (value: unknown) => void> = {};
    const connection = {
      on: (name: string, listener: (value: unknown) => void) => { listeners[name] = listener; },
      send: vi.fn(),
      close: vi.fn(),
      socket: { readyState: 1, on: vi.fn() },
      emit: (event: Record<string, unknown>) => listeners.event?.(event),
    };
    realtime.connections.push(connection);
    return connection;
  }),
}));
vi.mock("./ReadingAdvantageDB", () => ({ getArticleDetails: vi.fn() }));
vi.mock("./AIEvaluator", () => ({ evaluateConversationTranscript: vi.fn() }));

import { recoverVoiceSessions } from "./AiVoiceService";

const RESERVED_SECONDS = 600;
let sessionNumber = 0;

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

/** A pending call the client never reported as connected, with its provider sideband attached. */
async function attachPendingCall(startedAt: Date | null = null) {
  sessionNumber += 1;
  const voiceSessionId = `vs-${sessionNumber}`;
  const pending = {
    voiceSessionId,
    studentUserId: "student-1",
    providerCallId: `rtc_${sessionNumber}`,
    status: "ACTIVE",
    startedAt,
    reservedSeconds: RESERVED_SECONDS,
    expiresAt: new Date(Date.now() + 45_000),
  };
  prisma.aiVoiceSession.findMany.mockResolvedValue([pending]);
  prisma.aiVoiceSession.findUnique.mockResolvedValue(pending);
  await recoverVoiceSessions();
  return { voiceSessionId, provider: realtime.connections[realtime.connections.length - 1] };
}

describe("AI voice metering", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    process.env.OPENAI_API_KEY = "test-key";
    prisma.aiVoiceSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.activeAiVoiceSession.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it.each([
    ["the learner starts speaking", "input_audio_buffer.speech_started"],
    ["a reply is generated (e.g. requested over the data channel)", "response.created"],
  ])("starts the clock when %s, even if the client never called /connected", async (_label, type) => {
    const { voiceSessionId, provider } = await attachPendingCall();

    provider.emit({ type });
    await flush();

    expect(prisma.aiVoiceSession.updateMany).toHaveBeenCalledTimes(1);
    const [{ where, data }] = prisma.aiVoiceSession.updateMany.mock.calls[0];
    expect(where).toEqual({ voiceSessionId, status: "ACTIVE", startedAt: null });
    expect(data.expiresAt.getTime() - data.startedAt.getTime()).toBe(RESERVED_SECONDS * 1000);
    expect(prisma.activeAiVoiceSession.updateMany).toHaveBeenCalledWith({
      where: { voiceSessionId },
      data: { expiresAt: data.expiresAt },
    });
  });

  it("does not restart a clock the client already started, and checks only once", async () => {
    const { provider } = await attachPendingCall(new Date());

    provider.emit({ type: "input_audio_buffer.speech_started" });
    provider.emit({ type: "response.created" });
    await flush();

    expect(prisma.aiVoiceSession.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.aiVoiceSession.updateMany).not.toHaveBeenCalled();
  });

  it("ignores provider events that do not show the call in use", async () => {
    const { provider } = await attachPendingCall();

    provider.emit({ type: "session.created" });
    provider.emit({ type: "session.updated" });
    await flush();

    expect(prisma.aiVoiceSession.findUnique).not.toHaveBeenCalled();
    expect(prisma.aiVoiceSession.updateMany).not.toHaveBeenCalled();
  });
});
