// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

type Listener = (...args: any[]) => void;

class FakeSocket {
  connected = true;
  listeners = new Map<string, Listener>();
  emitted: Array<[string, any, any]> = [];
  on(event: string, listener: Listener) {
    this.listeners.set(event, listener);
    return this;
  }
  emit(event: string, payload: any, ack?: any) {
    this.emitted.push([event, payload, ack]);
    return this;
  }
  disconnect() {
    this.connected = false;
    return this;
  }
  fire(event: string, payload?: any) {
    this.listeners.get(event)?.(payload);
  }
  sent(event: string) {
    return this.emitted.filter(([name]) => name === event);
  }
}

const mocks = vi.hoisted(() => ({
  socket: null as any,
  toast: { error: vi.fn(), warning: vi.fn() },
}));
vi.mock("socket.io-client", () => ({ io: () => mocks.socket }));
vi.mock("../app/dashboard/actions", () => ({ getTutorSessionToken: async () => "token" }));
vi.mock("@/components/app/Toast", () => ({ toast: mocks.toast }));

import { useLessonSocket } from "./useLessonSocket";

const created = (overrides: Record<string, unknown> = {}) => ({
  sessionId: "room-1",
  currentPhase: 10,
  phaseVersion: 5,
  phaseChangeId: "p5",
  articleData: { title: "Article" },
  participants: [],
  gameState: null,
  ...overrides,
});

describe("tutor useLessonSocket", () => {
  let container: HTMLDivElement;
  let root: Root;
  let socket: FakeSocket;
  let hook: ReturnType<typeof useLessonSocket>;

  function Harness() {
    hook = useLessonSocket("tutor-1", "article-1", "class-1", "http://localhost:3002");
    return null;
  }

  const fire = async (event: string, payload?: unknown) => {
    await act(async () => {
      socket.fire(event, payload);
    });
  };

  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mocks.toast.error.mockClear();
    mocks.toast.warning.mockClear();
    socket = new FakeSocket();
    mocks.socket = socket;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await fire("connect");
    await fire("session_created", created());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows the lost connection while keeping the lesson on screen", async () => {
    await fire("disconnect");
    expect(hook.connectionLost).toBe(true);
    expect(hook.sessionData?.currentPhase).toBe(10);
    expect(hook.error).toBeNull();
    await fire("connect");
    expect(hook.connectionLost).toBe(false);
  });

  it("ignores an older snapshot of the same room", async () => {
    await fire("session_created", created({ phaseVersion: 3, currentPhase: 8 }));
    expect(hook.sessionData?.currentPhase).toBe(10);
  });

  it("adopts a new room even though its version counts from zero, and says the old one closed", async () => {
    await fire("session_created", created({ sessionId: "room-2", phaseVersion: 0, currentPhase: 0 }));
    expect(hook.sessionData?.sessionId).toBe("room-2");
    expect(hook.sessionData?.currentPhase).toBe(0);
    expect(mocks.toast.warning).toHaveBeenCalledTimes(1);
  });

  it("picks up answers already in when coming back to a question", async () => {
    await fire(
      "session_created",
      created({
        participants: [
          { studentId: "a", name: "A", score: 0, hasAnsweredCurrentPhase: true, latestAnswer: "B" },
          { studentId: "b", name: "B", score: 0, hasAnsweredCurrentPhase: false },
        ],
      }),
    );
    expect(hook.totalAnswered).toBe(1);
    expect(hook.questionEnded).toBe(false);
  });

  it("shows a failed phase change to the tutor instead of swallowing it", async () => {
    let result: boolean | undefined;
    await act(async () => {
      void hook.changePhase(11).then((ok) => {
        result = ok;
      });
    });
    const [, , ack] = socket.sent("change_phase")[0];
    await act(async () => {
      ack({ ok: false, message: "Could not change" });
    });
    expect(result).toBe(false);
    expect(mocks.toast.error).toHaveBeenCalledTimes(1);
    // A running lesson must not turn into the lobby's error page.
    expect(hook.error).toBeNull();
  });

  it("does not show the server's English errors during a lesson", async () => {
    await fire("error", { message: "You are not allowed to perform this action." });
    expect(mocks.toast.error).toHaveBeenCalledWith(expect.stringMatching(/[฀-๿]/));
    expect(hook.error).toBeNull();
  });

  it("shows no error card when the tutor finishes the class", async () => {
    let finished: boolean | undefined;
    await act(async () => {
      void hook.finishSession().then((ok) => {
        finished = ok;
      });
    });
    // The server tells the room first, then answers the tutor.
    await fire("session_deleted", { message: "บทเรียนจบแล้ว", reason: "finished" });
    expect(hook.error).toBeNull();
    const [, , ack] = socket.sent("finish_session")[0];
    await act(async () => {
      ack({ ok: true });
    });
    expect(finished).toBe(true);
    expect(hook.error).toBeNull();
  });

  it("still says so when the room is closed some other way", async () => {
    await fire("session_deleted", { message: "x", reason: "cancelled" });
    expect(hook.error).toBeTruthy();
  });

  it("ends the game only when the room is really ours", async () => {
    await act(async () => {
      hook.endGame();
    });
    expect(socket.sent("end_game")).toHaveLength(1);

    await fire("disconnect");
    socket.connected = false;
    await act(async () => {
      hook.endGame();
    });
    expect(socket.sent("end_game")).toHaveLength(1);
    expect(mocks.toast.error).toHaveBeenCalledTimes(1);
  });
});
