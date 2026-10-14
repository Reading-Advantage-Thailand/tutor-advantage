import { describe, expect, it } from "vitest";
import type { ChatConversation, ChatMessage } from "./chat-types";
import {
  buildTimeline,
  chatKeys,
  conversationPreview,
  filterConversations,
  formatDaySeparator,
  isValidConversationId,
  mergeServerMessages,
  newIncomingMessages,
} from "./chat-utils";

const msg = (id: string, time: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  text: `m-${id}`,
  senderId: "s1",
  senderName: "น้องฟ้า",
  time,
  isOwn: false,
  ...over,
});

const conv = (over: Partial<ChatConversation> = {}): ChatConversation => ({
  id: "c1",
  type: "DIRECT",
  title: "น้องฟ้า",
  updatedAt: "2026-10-02T08:00:00.000Z",
  unreadCount: 0,
  lastMessage: { content: "สวัสดีค่ะ", sender: "น้องฟ้า" },
  ...over,
});

describe("isValidConversationId", () => {
  it("accepts UUIDs only", () => {
    expect(isValidConversationId("c3000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isValidConversationId("../users/me")).toBe(false);
    expect(isValidConversationId("")).toBe(false);
    expect(isValidConversationId(undefined)).toBe(false);
  });
});

describe("chatKeys", () => {
  it("scopes every key to the tutor", () => {
    expect(chatKeys.conversations("t1")).toBe("t1:chat:conversations");
    expect(chatKeys.room("t1", "c1")).toBe("t1:chat:room:c1");
    expect(chatKeys.room("t1", "c1").startsWith(chatKeys.all("t1"))).toBe(true);
  });
});

describe("filterConversations", () => {
  const list = [conv({ id: "a", title: "Ploy" }), conv({ id: "b", title: "ต้นกล้า", lastMessage: { content: "ส่งการบ้านแล้ว" } })];
  it("returns everything for an empty query", () => {
    expect(filterConversations(list, "  ")).toBe(list);
  });
  it("matches title and last message, case-insensitively", () => {
    expect(filterConversations(list, "ploy").map((c) => c.id)).toEqual(["a"]);
    expect(filterConversations(list, "การบ้าน").map((c) => c.id)).toEqual(["b"]);
    expect(filterConversations(list, "zzz")).toEqual([]);
  });
});

describe("mergeServerMessages", () => {
  it("keeps pending optimistic messages after the server list", () => {
    const server = [msg("1", "2026-10-02T08:00:00Z")];
    const current = [msg("1", "2026-10-02T08:00:00Z"), msg("p", "2026-10-02T08:01:00Z", { pending: true, isOwn: true })];
    expect(mergeServerMessages(server, current).map((m) => m.id)).toEqual(["1", "p"]);
  });
  it("returns the server list as-is when nothing is pending", () => {
    const server = [msg("1", "2026-10-02T08:00:00Z")];
    expect(mergeServerMessages(server, undefined)).toBe(server);
  });
});

describe("newIncomingMessages", () => {
  it("finds new messages from other people only", () => {
    const prev = [msg("1", "2026-10-02T08:00:00Z")];
    const next = [...prev, msg("2", "2026-10-02T08:01:00Z"), msg("3", "2026-10-02T08:02:00Z", { isOwn: true })];
    expect(newIncomingMessages(prev, next).map((m) => m.id)).toEqual(["2"]);
  });
  it("ignores the first load", () => {
    expect(newIncomingMessages(undefined, [msg("1", "2026-10-02T08:00:00Z")])).toEqual([]);
  });
});

describe("conversationPreview", () => {
  it("prefixes own messages and group senders", () => {
    expect(conversationPreview(conv({ lastMessage: { content: "โอเค", sender: "คุณ" } }), "คุณ")).toBe("คุณ: โอเค");
    expect(conversationPreview(conv({ type: "GROUP", lastMessage: { content: "ค่ะ", sender: "Ploy" } }), "คุณ")).toBe("Ploy: ค่ะ");
    expect(conversationPreview(conv(), "คุณ")).toBe("สวัสดีค่ะ");
    expect(conversationPreview(conv({ lastMessage: null }), "คุณ")).toBeNull();
  });
});

describe("formatDaySeparator", () => {
  const now = new Date("2026-10-02T05:00:00Z"); // Fri 2 Oct 2026, 12:00 Bangkok
  it("uses relative words for today and yesterday", () => {
    expect(formatDaySeparator("2026-10-02T01:00:00Z", now)).toBe("วันนี้");
    expect(formatDaySeparator("2026-10-01T01:00:00Z", now)).toBe("เมื่อวาน");
  });
  it("uses Buddhist-era dates for other years", () => {
    expect(formatDaySeparator("2025-12-25T05:00:00Z", now)).toContain("2568");
    expect(formatDaySeparator("2026-09-25T05:00:00Z", now)).not.toContain("2569");
  });
});

describe("buildTimeline", () => {
  const now = new Date("2026-10-02T05:00:00Z");
  it("inserts one separator per Bangkok day and groups sender runs", () => {
    const items = buildTimeline(
      [
        msg("1", "2026-10-01T10:00:00Z"),
        msg("2", "2026-10-02T01:00:00Z"),
        msg("3", "2026-10-02T01:02:00Z"),
        msg("4", "2026-10-02T01:03:00Z", { isOwn: true, senderId: "me" }),
        msg("5", "2026-10-02T01:30:00Z"),
      ],
      now,
    );
    expect(items.map((i) => (i.kind === "day" ? `day:${i.label}` : i.key))).toEqual([
      "day:เมื่อวาน",
      "1",
      "day:วันนี้",
      "2",
      "3",
      "4",
      "5",
    ]);
    const byKey = Object.fromEntries(items.filter((i) => i.kind === "message").map((i) => [i.key, i]));
    expect(byKey["2"]).toMatchObject({ startsGroup: true, endsGroup: false });
    expect(byKey["3"]).toMatchObject({ startsGroup: false, endsGroup: true });
    expect(byKey["4"]).toMatchObject({ startsGroup: true, endsGroup: true });
    // same sender as 3 but 28 minutes later: new run
    expect(byKey["5"]).toMatchObject({ startsGroup: true, endsGroup: true });
  });
  it("is empty for no messages", () => {
    expect(buildTimeline([], now)).toEqual([]);
  });
});
