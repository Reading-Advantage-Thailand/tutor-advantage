// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Conversation, ConversationsResponse } from "./conversations";
import { useConversationListPolling } from "./useConversationListPolling";

vi.mock("../../../lib/sounds", () => ({ playNotificationSound: vi.fn() }));
import { playNotificationSound } from "../../../lib/sounds";

function list(...unread: number[]): ConversationsResponse {
  return {
    conversations: unread.map(
      (count, index): Conversation => ({
        id: `c${index}`,
        title: `Chat ${index}`,
        unreadCount: count,
        updatedAt: "2026-10-02T02:00:00.000Z",
        type: "DIRECT",
      }),
    ),
  };
}

let container: HTMLDivElement;
let root: Root;

function Probe({ refetch }: { refetch: () => Promise<ConversationsResponse | undefined> }) {
  useConversationListPolling(refetch, { enabled: true, interval: 15000 });
  return null;
}

async function render(refetch: () => Promise<ConversationsResponse | undefined>) {
  await act(async () => {
    root.render(React.createElement(Probe, { refetch }));
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

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

describe("useConversationListPolling", () => {
  it("fetches right away and every 15s", async () => {
    const refetch = vi.fn().mockResolvedValue(list(0));
    await render(refetch);
    expect(refetch).toHaveBeenCalledTimes(1);
    await advance(15000);
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("never chimes for the first list fetched after opening the screen, even with unread messages", async () => {
    const refetch = vi.fn().mockResolvedValue(list(3, 2));
    await render(refetch);
    await advance(15000);
    expect(playNotificationSound).not.toHaveBeenCalled();
  });

  it("chimes only when the unread total goes up", async () => {
    const refetch = vi
      .fn()
      .mockResolvedValueOnce(list(1))
      .mockResolvedValueOnce(list(1))
      .mockResolvedValueOnce(list(0))
      .mockResolvedValueOnce(list(0, 2));
    await render(refetch);
    await advance(15000); // same total
    await advance(15000); // read: total goes down
    expect(playNotificationSound).not.toHaveBeenCalled();
    await advance(15000); // a new message
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
  });

  it("ignores failed fetches (no baseline from them)", async () => {
    const refetch = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(list(4)).mockResolvedValueOnce(list(5));
    await render(refetch);
    await advance(15000);
    expect(playNotificationSound).not.toHaveBeenCalled();
    await advance(15000);
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
  });
});
