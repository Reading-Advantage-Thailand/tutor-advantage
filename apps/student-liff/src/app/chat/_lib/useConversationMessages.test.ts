// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ChatMessage, ConversationPayload } from "./messages";
import {
  useConversationMessages,
  type ConversationClient,
  type SendResult,
  type UseConversationMessages,
} from "./useConversationMessages";

vi.mock("../../../lib/sounds", () => ({ playNotificationSound: vi.fn() }));
import { playNotificationSound } from "../../../lib/sounds";

const META = { id: "c1", title: "ครูเอ", image: null, fallbackIcon: "User", status: "ออนไลน์" };

function msg(id: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    text: `text ${id}`,
    senderId: "tutor",
    senderName: "ครูเอ",
    time: new Date(2026, 9, 2, 9, 0).toISOString(),
    isOwn: false,
    ...overrides,
  };
}

function payload(messages: ChatMessage[]): ConversationPayload {
  return { metadata: META, messages };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let container: HTMLDivElement;
let root: Root;
let result: UseConversationMessages;

function Probe({ client }: { client: ConversationClient }) {
  result = useConversationMessages("c1", { client, enabled: true, ownName: "คุณ", interval: 4000 });
  return null;
}

async function render(client: ConversationClient) {
  await act(async () => {
    root.render(React.createElement(Probe, { client }));
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const ids = () => result.messages.map((m) => m.id);

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(playNotificationSound).mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useConversationMessages", () => {
  it("loads history and keeps the same array when a poll changes nothing", async () => {
    const getMessages = vi.fn().mockResolvedValue(payload([msg("1"), msg("2")]));
    await render({ getMessages, sendMessage: vi.fn() });

    expect(result.isLoading).toBe(false);
    expect(ids()).toEqual(["1", "2"]);
    expect(result.metadata).toEqual(META);
    const first = result.messages;

    await advance(4000);
    expect(getMessages).toHaveBeenCalledTimes(2);
    expect(result.messages).toBe(first);
    expect(playNotificationSound).not.toHaveBeenCalled();
  });

  it("chimes only for new messages from others after the first load", async () => {
    const getMessages = vi
      .fn()
      .mockResolvedValueOnce(payload([msg("1")]))
      .mockResolvedValueOnce(payload([msg("1"), msg("2", { isOwn: true, senderId: "me" })]))
      .mockResolvedValueOnce(payload([msg("1"), msg("2", { isOwn: true, senderId: "me" }), msg("3")]));
    await render({ getMessages, sendMessage: vi.fn() });
    await advance(4000);
    expect(playNotificationSound).not.toHaveBeenCalled();
    await advance(4000);
    expect(ids()).toEqual(["1", "2", "3"]);
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
  });

  it("shows an optimistic bubble, confirms it and never duplicates it", async () => {
    const getMessages = vi.fn().mockResolvedValue(payload([msg("1")]));
    const post = deferred<{ id: string; time: string }>();
    const sendMessage = vi.fn().mockReturnValue(post.promise);
    await render({ getMessages, sendMessage });

    let sendResult: Promise<SendResult> | undefined;
    await act(async () => {
      sendResult = result.send("สวัสดีครับ");
    });
    expect(sendMessage).toHaveBeenCalledWith("c1", "สวัสดีครับ");
    expect(result.isSending).toBe(true);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1]).toMatchObject({ text: "สวัสดีครับ", isOwn: true, pending: true });
    expect(String(result.messages[1].id).startsWith("temp-")).toBe(true);

    // A poll while the POST is in flight already contains the server copy: ignored (no duplicate).
    getMessages.mockResolvedValue(payload([msg("1"), msg("srv-2", { isOwn: true, text: "สวัสดีครับ" })]));
    await advance(4000);
    expect(result.messages).toHaveLength(2);

    const time = new Date(2026, 9, 2, 9, 1).toISOString();
    await act(async () => {
      post.resolve({ id: "srv-2", time });
      await sendResult;
    });
    await expect(sendResult).resolves.toBe("sent");
    expect(result.isSending).toBe(false);
    expect(ids()).toEqual(["1", "srv-2"]);
    expect(result.messages[1]).toMatchObject({ pending: false, time });

    await advance(4000);
    expect(ids()).toEqual(["1", "srv-2"]);
    expect(result.messages[1].pending).toBeUndefined();
  });

  it("ignores a poll that started before the send (the new message is not dropped)", async () => {
    const getMessages = vi.fn().mockResolvedValueOnce(payload([msg("1")]));
    const slowPoll = deferred<ConversationPayload>();
    getMessages.mockReturnValueOnce(slowPoll.promise);
    const sendMessage = vi.fn().mockResolvedValue({ id: "srv-2", time: new Date().toISOString() });
    await render({ getMessages, sendMessage });

    await advance(4000); // second poll starts and hangs
    expect(getMessages).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.send("hi");
    });
    expect(ids()).toEqual(["1", "srv-2"]);

    await act(async () => {
      slowPoll.resolve(payload([msg("1")])); // history from before the send
    });
    expect(ids()).toEqual(["1", "srv-2"]);
  });

  it("skips a second send while the first is still in flight", async () => {
    const getMessages = vi.fn().mockResolvedValue(payload([msg("1")]));
    const post = deferred<{ id: string; time: string }>();
    const sendMessage = vi.fn().mockReturnValue(post.promise);
    await render({ getMessages, sendMessage });

    let first: Promise<SendResult> | undefined;
    let second: SendResult | undefined;
    await act(async () => {
      first = result.send("one");
      second = await result.send("two");
    });
    expect(second).toBe("skipped");
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(result.messages.map((m) => m.text)).toEqual(["text 1", "one"]);

    await act(async () => {
      post.resolve({ id: "srv-1", time: new Date(2026, 9, 2, 9, 1).toISOString() });
      await first;
    });
    await expect(first).resolves.toBe("sent");
  });

  it("shows an empty room when the first response has no body", async () => {
    const getMessages = vi.fn().mockResolvedValue(undefined);
    await render({ getMessages, sendMessage: vi.fn() });
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
    expect(result.messages).toEqual([]);
  });

  it("removes the bubble and reports failure when the send fails", async () => {
    const getMessages = vi.fn().mockResolvedValue(payload([msg("1")]));
    const sendMessage = vi.fn().mockRejectedValue(new Error("500"));
    await render({ getMessages, sendMessage });

    let outcome: SendResult = "sent";
    await act(async () => {
      outcome = await result.send("hello");
    });
    expect(outcome).toBe("failed");
    expect(ids()).toEqual(["1"]);
    expect(result.isSending).toBe(false);
  });

  it("stops polling after a 403 on the first load, but retry still runs", async () => {
    const getMessages = vi.fn().mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    await render({ getMessages, sendMessage: vi.fn() });
    expect(result.error).toBeTruthy();
    await advance(12000);
    expect(getMessages).toHaveBeenCalledTimes(1);

    getMessages.mockResolvedValueOnce(payload([msg("1")]));
    await act(async () => {
      await result.refresh();
    });
    expect(ids()).toEqual(["1"]);
  });

  it("reports a first-load error, marks later failures as stale and recovers", async () => {
    const getMessages = vi.fn().mockRejectedValueOnce(new Error("offline"));
    await render({ getMessages, sendMessage: vi.fn() });
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeInstanceOf(Error);

    getMessages.mockResolvedValueOnce(payload([msg("1")]));
    await act(async () => {
      await result.refresh();
    });
    expect(result.error).toBeNull();
    expect(ids()).toEqual(["1"]);

    getMessages.mockRejectedValueOnce(new Error("offline"));
    await advance(4000);
    expect(result.isStale).toBe(true);
    expect(ids()).toEqual(["1"]);

    getMessages.mockResolvedValueOnce(payload([msg("1")]));
    await advance(4000);
    expect(result.isStale).toBe(false);
  });
});
