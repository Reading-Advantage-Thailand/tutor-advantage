import { describe, expect, it } from "vitest";
import {
  conversationsResourceKey,
  filterClasses,
  filterConversations,
  getConversationPreview,
  initiateKey,
  markConversationRead,
  shouldPlayUnreadSound,
  totalUnread,
  type Conversation,
} from "./conversations";

const labels = { you: "คุณ", youPrefix: "คุณ: ", noMessages: "ยังไม่มีข้อความ" };

function conv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    title: "Teacher Ann",
    unreadCount: 0,
    updatedAt: "2026-10-02T02:00:00.000Z",
    type: "DIRECT",
    lastMessage: { sender: "Teacher Ann", content: "Hello" },
    ...overrides,
  };
}

describe("getConversationPreview", () => {
  it("prefixes our own last message with the 'you' label", () => {
    expect(getConversationPreview(conv({ lastMessage: { sender: "คุณ", content: "ส่งการบ้านแล้ว" } }), labels)).toBe(
      "คุณ: ส่งการบ้านแล้ว",
    );
  });

  it("shows other people's messages as-is", () => {
    expect(getConversationPreview(conv(), labels)).toBe("Hello");
  });

  it("falls back when there is no message yet", () => {
    expect(getConversationPreview(conv({ lastMessage: null }), labels)).toBe("ยังไม่มีข้อความ");
    expect(getConversationPreview(conv({ lastMessage: undefined }), labels)).toBe("ยังไม่มีข้อความ");
  });
});

describe("unread", () => {
  it("sums unread counts, tolerating missing values", () => {
    expect(totalUnread([conv({ unreadCount: 2 }), conv({ unreadCount: 3 }), conv({ unreadCount: undefined as unknown as number })])).toBe(5);
  });

  it("chimes only when the total increases after the first observation", () => {
    expect(shouldPlayUnreadSound(undefined, 4)).toBe(false);
    expect(shouldPlayUnreadSound(4, 4)).toBe(false);
    expect(shouldPlayUnreadSound(4, 2)).toBe(false);
    expect(shouldPlayUnreadSound(2, 3)).toBe(true);
  });
});

describe("search filters", () => {
  it("matches conversation titles case-insensitively", () => {
    const list = [conv({ id: "a", title: "Teacher Ann" }), conv({ id: "b", title: "กลุ่ม Reading" })];
    expect(filterConversations(list, "ann").map((c) => c.id)).toEqual(["a"]);
    expect(filterConversations(list, "").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("matches class or tutor names", () => {
    const classes = [
      { id: "1", name: "Reading A1", tutorName: "ครูเอ", tutorUserId: "t1" },
      { id: "2", name: "Phonics", tutorName: "Teacher Bee", tutorUserId: "t2" },
    ];
    expect(filterClasses(classes, "bee").map((c) => c.id)).toEqual(["2"]);
    expect(filterClasses(classes, "reading").map((c) => c.id)).toEqual(["1"]);
  });
});

it("builds the initiate key used for the row spinner", () => {
  expect(initiateKey("GROUP", "cls-1")).toBe("GROUP-cls-1");
});

describe("conversation cache helpers", () => {
  it("uses a per-student key", () => {
    expect(conversationsResourceKey("U1")).toBe("U1:chat:conversations");
  });

  it("clears the unread badge of the opened room only", () => {
    const response = { conversations: [conv({ id: "a", unreadCount: 2 }), conv({ id: "b", unreadCount: 1 })] };
    const next = markConversationRead(response, "a");
    expect(next?.conversations?.map((c) => [c.id, c.unreadCount])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
    expect(response.conversations[0].unreadCount).toBe(2);
  });

  it("returns the same object when nothing changes", () => {
    const response = { conversations: [conv({ id: "a", unreadCount: 0 })] };
    expect(markConversationRead(response, "a")).toBe(response);
    expect(markConversationRead(response, "missing")).toBe(response);
    expect(markConversationRead(undefined, "a")).toBeUndefined();
  });
});
