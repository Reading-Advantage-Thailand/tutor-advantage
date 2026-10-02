import { describe, expect, it } from "vitest";
import {
  buildDisplayMessages,
  buildMessageItems,
  canApplyPollResult,
  createTempId,
  dedupeById,
  hasNewIncomingMessage,
  isFatalLoadError,
  isTempId,
  pruneOutbox,
  reconcileServerMessages,
  sameMetadata,
  type ChatMessage,
  type OutboxEntry,
} from "./messages";

const at = (h: number, m: number, day = 2) => new Date(2026, 9, day, h, m).toISOString();

function msg(id: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    text: `text ${id}`,
    senderId: "tutor",
    senderName: "ครูเอ",
    senderImage: null,
    time: at(9, 0),
    isOwn: false,
    ...overrides,
  };
}

describe("temp ids", () => {
  it("keeps the temp- prefix and stays unique within one millisecond", () => {
    const a = createTempId(1000, 1);
    const b = createTempId(1000, 2);
    expect(isTempId(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(isTempId("m1")).toBe(false);
  });
});

describe("reconcileServerMessages", () => {
  it("returns the previous array when a poll brings the same history", () => {
    const previous = [msg("1"), msg("2")];
    const result = reconcileServerMessages(previous, [msg("1"), msg("2")]);
    expect(result).toBe(previous);
  });

  it("returns new history when something changed, without duplicate ids", () => {
    const previous = [msg("1")];
    const result = reconcileServerMessages(previous, [msg("1"), msg("2"), msg("2")]);
    expect(result).not.toBe(previous);
    expect(result.map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("keeps the objects of unchanged messages when a new one arrives (memoised bubbles stay put)", () => {
    const previous = [msg("1"), msg("2")];
    const result = reconcileServerMessages(previous, [msg("1"), msg("2", { text: "edited" }), msg("3")]);
    expect(result).not.toBe(previous);
    expect(result[0]).toBe(previous[0]);
    expect(result[1]).not.toBe(previous[1]);
    expect(result[1].text).toBe("edited");
    expect(result.map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("treats a missing list as empty", () => {
    expect(reconcileServerMessages(null, undefined)).toEqual([]);
  });

  it("dedupeById keeps the first copy", () => {
    expect(dedupeById([msg("a", { text: "first" }), msg("a", { text: "second" })])).toEqual([
      msg("a", { text: "first" }),
    ]);
  });
});

describe("outbox merge", () => {
  const pending: OutboxEntry = { tempId: "temp-1-1", text: "hi", time: at(9, 5) };
  const confirmed: OutboxEntry = { ...pending, serverId: "srv-9", serverTime: at(9, 6) };

  it("shows a pending send after the server history", () => {
    const shown = buildDisplayMessages([msg("1")], [pending], "คุณ");
    expect(shown.map((m) => m.id)).toEqual(["1", "temp-1-1"]);
    expect(shown[1]).toMatchObject({ isOwn: true, senderId: "me", senderName: "คุณ", pending: true, text: "hi" });
  });

  it("shows a confirmed send under its server id until the history contains it", () => {
    const shown = buildDisplayMessages([msg("1")], [confirmed], "คุณ");
    expect(shown[1]).toMatchObject({ id: "srv-9", time: at(9, 6), pending: false });
  });

  it("never shows a confirmed send twice once the history has it", () => {
    const server = [msg("1"), msg("srv-9", { isOwn: true, text: "hi" })];
    expect(buildDisplayMessages(server, [confirmed], "คุณ").map((m) => m.id)).toEqual(["1", "srv-9"]);
    expect(pruneOutbox([confirmed], server)).toEqual([]);
  });

  it("keeps the outbox array when nothing was pruned", () => {
    const outbox = [pending, confirmed];
    expect(pruneOutbox(outbox, [msg("1")])).toBe(outbox);
  });

  it("returns the server array itself when there is nothing local", () => {
    const server = [msg("1")];
    expect(buildDisplayMessages(server, [], "คุณ")).toBe(server);
  });
});

describe("canApplyPollResult", () => {
  it("rejects polls that overlapped a send", () => {
    expect(canApplyPollResult(3, 3, 0)).toBe(true);
    expect(canApplyPollResult(3, 4, 0)).toBe(false);
    expect(canApplyPollResult(3, 3, 1)).toBe(false);
  });
});

describe("hasNewIncomingMessage", () => {
  it("ignores the first load", () => {
    expect(hasNewIncomingMessage(null, [msg("1")])).toBe(false);
  });

  it("detects a new message from someone else", () => {
    expect(hasNewIncomingMessage([msg("1")], [msg("1"), msg("2")])).toBe(true);
    expect(hasNewIncomingMessage([], [msg("1")])).toBe(true);
  });

  it("ignores our own messages and unchanged history", () => {
    expect(hasNewIncomingMessage([msg("1")], [msg("1"), msg("2", { isOwn: true })])).toBe(false);
    expect(hasNewIncomingMessage([msg("1")], [msg("1")])).toBe(false);
  });
});

describe("isFatalLoadError", () => {
  it("is true only for not-a-participant / not-found", () => {
    expect(isFatalLoadError({ status: 403 })).toBe(true);
    expect(isFatalLoadError({ status: 404 })).toBe(true);
    expect(isFatalLoadError({ status: 500 })).toBe(false);
    expect(isFatalLoadError(new Error("offline"))).toBe(false);
    expect(isFatalLoadError(null)).toBe(false);
  });
});

describe("sameMetadata", () => {
  it("compares fields", () => {
    const a = { id: "c", title: "ครูเอ", image: null, fallbackIcon: "User", status: "x" };
    expect(sameMetadata(a, { ...a })).toBe(true);
    expect(sameMetadata(a, { ...a, title: "ครูบี" })).toBe(false);
    expect(sameMetadata(null, a)).toBe(false);
  });
});

describe("buildMessageItems", () => {
  const now = new Date(2026, 9, 2, 12, 0);

  it("adds a day separator when the day changes", () => {
    const items = buildMessageItems(
      [msg("1", { time: at(20, 0, 1) }), msg("2", { time: at(9, 0, 2) })],
      now,
    );
    expect(items.map((item) => (item.kind === "date" ? item.label : item.key))).toEqual([
      "เมื่อวาน",
      "1",
      "วันนี้",
      "2",
    ]);
  });

  it("groups consecutive bubbles from the same sender within 5 minutes", () => {
    const items = buildMessageItems(
      [
        msg("a", { time: at(9, 0) }),
        msg("b", { time: at(9, 2) }),
        msg("c", { time: at(9, 30) }),
        msg("d", { time: at(9, 31), isOwn: true, senderId: "me" }),
      ],
      now,
    ).filter((item) => item.kind === "message");
    const flags = items.map((item) =>
      item.kind === "message" ? [item.key, item.isFirstInGroup, item.isLastInGroup] : null,
    );
    expect(flags).toEqual([
      ["a", true, false],
      ["b", false, true],
      ["c", true, true],
      ["d", true, true],
    ]);
  });
});
