// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

type Listener = (...args: any[]) => void;

class FakeSocket {
  connected = true;
  listeners = new Map<string, Listener>();
  emitted: Array<[string, any]> = [];
  on(event: string, listener: Listener) {
    this.listeners.set(event, listener);
    return this;
  }
  emit(event: string, payload: any) {
    this.emitted.push([event, payload]);
    return this;
  }
  disconnect() {
    this.connected = false;
    return this;
  }
  connect() {
    this.connected = true;
    return this;
  }
  fire(event: string, payload?: any) {
    this.listeners.get(event)?.(payload);
  }
  sent(event: string) {
    return this.emitted.filter(([name]) => name === event);
  }
}

const sockets = vi.hoisted(() => ({ current: null as any }));
vi.mock("socket.io-client", () => ({
  io: () => sockets.current,
}));

import { useLessonSocket } from "./useLessonSocket";
import { createRoundClock, setLiveRoundStartedAt } from "../lib/games/roundClock";

const joinPayload = (overrides: Record<string, unknown> = {}) => ({
  sessionId: "room-1",
  currentStudentId: "student-1",
  currentPhase: 10,
  phaseVersion: 5,
  articleData: { title: "Article" },
  gameState: null,
  ...overrides,
});

const playingGame = (overrides: Record<string, unknown> = {}) => ({
  phase: 10,
  category: "vocabulary",
  status: "playing",
  votes: {},
  selectedGameId: "dragon-flight",
  results: {},
  playingStartedAt: 50_000,
  serverNow: 80_000,
  ...overrides,
});

describe("student useLessonSocket", () => {
  let container: HTMLDivElement;
  let root: Root;
  let socket: FakeSocket;
  let hook: ReturnType<typeof useLessonSocket>;

  function Harness() {
    hook = useLessonSocket("class-1", "student-1", "Ada");
    return null;
  }

  const fire = async (event: string, payload?: unknown) => {
    await act(async () => {
      socket.fire(event, payload);
    });
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ socketToken: "token" }) })));
    socket = new FakeSocket();
    sockets.current = socket;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await fire("connect");
    await fire("join_success", joinPayload());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setLiveRoundStartedAt(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the same article object on a reconnect, so a running game does not restart", async () => {
    const first = hook.articleData;
    await fire("join_success", joinPayload({ articleData: { title: "Article" } }));
    expect(hook.articleData).toBe(first);
  });

  it("adopts a new room even though its version counts from zero", async () => {
    await fire("join_success", joinPayload({ sessionId: "room-2", phaseVersion: 0, currentPhase: 0, articleData: { title: "New" } }));
    expect(hook.sessionData?.sessionId).toBe("room-2");
    expect(hook.articleData?.title).toBe("New");
  });

  it("still ignores an older snapshot of the same room", async () => {
    await fire("join_success", joinPayload({ phaseVersion: 3, currentPhase: 8 }));
    expect(hook.sessionData?.currentPhase).toBe(10);
  });

  it("shows the tutor's connection state", async () => {
    expect(hook.tutorAway).toBe(false);
    await fire("tutor_away");
    expect(hook.tutorAway).toBe(true);
    await fire("tutor_back");
    expect(hook.tutorAway).toBe(false);
    await fire("join_success", joinPayload({ tutorAway: true }));
    expect(hook.tutorAway).toBe(true);
  });

  it("offers to rejoin when the room ends without the lesson finishing, and goes back in when it returns", async () => {
    await fire("session_deleted", { message: "การเชื่อมต่อของคุณครูขาดหาย", reason: "tutor_lost" });
    expect(hook.kicked).toBeTruthy();
    expect(hook.roomInterrupted).toBe(true);
    expect(socket.connected).toBe(true);

    const joinsBefore = socket.sent("join_class").length;
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(socket.sent("join_class").length).toBe(joinsBefore + 1);

    await fire("join_success", joinPayload({ sessionId: "room-2", phaseVersion: 0, currentPhase: 0 }));
    expect(hook.kicked).toBeNull();
    expect(hook.roomInterrupted).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(socket.sent("join_class").length).toBe(joinsBefore + 1);
  });

  it("treats a finished lesson as over", async () => {
    await fire("session_deleted", { message: "บทเรียนจบแล้ว", reason: "finished" });
    expect(hook.kicked).toBeTruthy();
    expect(hook.roomInterrupted).toBe(false);
    expect(socket.connected).toBe(false);
  });

  it("keeps trying when no room is open yet, and clears the message when one opens", async () => {
    const notOpen = "ยังไม่มีคลาสที่เปิดสอนในขณะนี้ หรือคุณครูยังไม่ได้เริ่มเซสชัน";
    await fire("error", { message: notOpen });
    expect(hook.error).toBe(notOpen);
    const joinsBefore = socket.sent("join_class").length;
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(socket.sent("join_class").length).toBe(joinsBefore + 1);
    await fire("join_success", joinPayload());
    expect(hook.error).toBeNull();
  });

  it("does not alarm on a dropped socket unless an answer was on its way", async () => {
    await fire("disconnect", "transport close");
    expect(hook.connectionLost).toBe(true);
    expect(hook.submissionError).toBeNull();
    await fire("connect");
    expect(hook.connectionLost).toBe(false);

    await fire("join_success", joinPayload());
    await act(async () => {
      hook.submitAnswer("A");
    });
    await fire("disconnect", "transport close");
    expect(hook.submissionError).toBeTruthy();
  });

  it("reads the server's clock from game states", async () => {
    await fire("game_state_changed", { gameState: playingGame({ status: "countdown", serverNow: Date.now() + 90_000 }) });
    expect(Math.round(hook.clockOffsetMs / 1000)).toBe(90);
  });

  it("sends a result again when the server never received it", async () => {
    await fire("join_success", joinPayload({ gameState: playingGame() }));
    await act(async () => {
      hook.submitGameResult({ gameId: "dragon-flight", score: 4, correct: 4, total: 10 });
    });
    expect(socket.sent("submit_game_result")).toHaveLength(1);

    await fire("join_success", joinPayload({ gameState: playingGame() }));
    expect(socket.sent("submit_game_result")).toHaveLength(2);

    await fire("join_success", joinPayload({ gameState: playingGame({ results: { "student-1": { score: 4 } } }) }));
    expect(socket.sent("submit_game_result")).toHaveLength(2);
  });

  it("plays only the time left after joining a round already running", async () => {
    await fire("join_success", joinPayload({ gameState: playingGame() }));
    const clock = createRoundClock({ durationMs: 60_000 });
    clock.start();
    expect(Math.round(clock.remainingMs() / 1000)).toBe(30);
    clock.stop();
  });

  it("gives a full round to a phone that saw the round start", async () => {
    await fire("join_success", joinPayload({ gameState: playingGame({ status: "countdown" }) }));
    await fire("game_state_changed", { gameState: playingGame({ serverNow: 50_100 }) });
    const clock = createRoundClock({ durationMs: 60_000 });
    clock.start();
    expect(Math.round(clock.remainingMs() / 1000)).toBe(60);
    clock.stop();
  });
});
