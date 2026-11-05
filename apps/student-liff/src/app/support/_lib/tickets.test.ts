import { describe, expect, it } from "vitest";
import {
  STUDENT_TICKET_CATEGORIES,
  buildThreadItems,
  countUnread,
  formatTicketNumber,
  getCategoryLabelKey,
  getInitialTab,
  getLastMessageId,
  getStatusDisplay,
  getStatusEventCopy,
  isStudentCategory,
  markTicketRead,
  splitTickets,
  upsertTicketSummary,
  type TicketDetail,
  type TicketMessage,
  type TicketSummary,
} from "./tickets";

function summary(overrides: Partial<TicketSummary> = {}): TicketSummary {
  return {
    ticketId: "t-1",
    ticketNumber: 1,
    category: "REFUND",
    subject: "ขอคืนเงิน",
    status: "OPEN",
    classId: null,
    classTitle: null,
    createdAt: "2026-11-01T03:00:00.000Z",
    updatedAt: "2026-11-01T03:00:00.000Z",
    lastMessageAt: "2026-11-01T03:00:00.000Z",
    hasUnreadReply: false,
    ...overrides,
  };
}

function detail(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return { ...summary(), paymentReference: null, resolvedAt: null, canReply: true, messages: [], ...overrides };
}

function message(overrides: Partial<TicketMessage> = {}): TicketMessage {
  return {
    messageId: "m-1",
    kind: "MESSAGE",
    author: "REQUESTER",
    body: "สวัสดีค่ะ",
    fromStatus: null,
    toStatus: null,
    createdAt: "2026-11-01T03:00:00.000Z",
    ...overrides,
  };
}

describe("categories", () => {
  it("offers exactly the student categories of the contract", () => {
    expect(STUDENT_TICKET_CATEGORIES).toEqual([
      "REFUND",
      "BOOK_DELIVERY",
      "BOOK_DAMAGED",
      "CLASS",
      "PRIVACY",
      "TECHNICAL",
      "OTHER",
    ]);
    expect(isStudentCategory("PAYOUT")).toBe(false);
    expect(isStudentCategory("refund")).toBe(false);
    expect(isStudentCategory("REFUND")).toBe(true);
  });

  it("maps categories to label keys with an OTHER fallback", () => {
    expect(getCategoryLabelKey("BOOK_DAMAGED")).toBe("support.category.BOOK_DAMAGED");
    expect(getCategoryLabelKey("PAYOUT")).toBe("support.category.PAYOUT");
    expect(getCategoryLabelKey("SOMETHING")).toBe("support.category.OTHER");
    expect(getCategoryLabelKey(null)).toBe("support.category.OTHER");
  });
});

describe("getStatusDisplay", () => {
  it("gives every status a tone and label", () => {
    expect(getStatusDisplay("OPEN")).toEqual({ tone: "info", labelKey: "support.status.OPEN" });
    expect(getStatusDisplay("IN_PROGRESS")).toEqual({ tone: "brand", labelKey: "support.status.IN_PROGRESS" });
    expect(getStatusDisplay("WAITING_ON_REQUESTER")).toEqual({
      tone: "warning",
      labelKey: "support.status.WAITING_ON_REQUESTER",
    });
    expect(getStatusDisplay("RESOLVED")).toEqual({ tone: "success", labelKey: "support.status.RESOLVED" });
    expect(getStatusDisplay("???").tone).toBe("neutral");
  });
});

describe("formatTicketNumber", () => {
  it("prefixes the number with #", () => {
    expect(formatTicketNumber(123)).toBe("#123");
    expect(formatTicketNumber(undefined)).toBe("");
  });
});

describe("splitTickets", () => {
  it("separates resolved tickets and sorts newest activity first", () => {
    const tickets = [
      summary({ ticketId: "a", status: "OPEN", lastMessageAt: "2026-11-01T00:00:00Z" }),
      summary({ ticketId: "b", status: "RESOLVED", lastMessageAt: "2026-11-03T00:00:00Z" }),
      summary({ ticketId: "c", status: "WAITING_ON_REQUESTER", lastMessageAt: "2026-11-04T00:00:00Z" }),
      summary({ ticketId: "d", status: "IN_PROGRESS", lastMessageAt: "2026-11-02T00:00:00Z" }),
    ];
    const { open, closed } = splitTickets(tickets);
    expect(open.map((ticket) => ticket.ticketId)).toEqual(["c", "d", "a"]);
    expect(closed.map((ticket) => ticket.ticketId)).toEqual(["b"]);
    expect(splitTickets(undefined)).toEqual({ open: [], closed: [] });
  });

  it("counts unread replies and opens the tab that has them", () => {
    const openUnread = [summary({ ticketId: "a", hasUnreadReply: true }), summary({ ticketId: "b", status: "RESOLVED" })];
    expect(countUnread(openUnread)).toBe(1);
    expect(getInitialTab(openUnread)).toBe("open");

    const closedUnread = [summary({ ticketId: "a" }), summary({ ticketId: "b", status: "RESOLVED", hasUnreadReply: true })];
    expect(getInitialTab(closedUnread)).toBe("closed");
    expect(getInitialTab([])).toBe("open");
  });
});

describe("list cache helpers", () => {
  it("clears one ticket's unread dot and keeps the object when nothing changes", () => {
    const list = { tickets: [summary({ ticketId: "a", hasUnreadReply: true }), summary({ ticketId: "b" })] };
    const next = markTicketRead(list, "a");
    expect(next?.tickets.map((ticket) => ticket.hasUnreadReply)).toEqual([false, false]);
    expect(markTicketRead(next, "a")).toBe(next);
    expect(markTicketRead(list, "missing")).toBe(list);
    expect(markTicketRead(undefined, "a")).toBeUndefined();
  });

  it("replaces or adds a ticket from its detail, newest first", () => {
    const list = {
      tickets: [
        summary({ ticketId: "a", lastMessageAt: "2026-11-02T00:00:00Z" }),
        summary({ ticketId: "b", lastMessageAt: "2026-11-01T00:00:00Z" }),
      ],
    };
    const updated = upsertTicketSummary(
      list,
      detail({ ticketId: "b", status: "RESOLVED", lastMessageAt: "2026-11-05T00:00:00Z", hasUnreadReply: true }),
    );
    expect(updated?.tickets.map((ticket) => [ticket.ticketId, ticket.status, ticket.hasUnreadReply])).toEqual([
      ["b", "RESOLVED", false],
      ["a", "OPEN", false],
    ]);
    expect(updated?.tickets[0]).not.toHaveProperty("messages");

    const added = upsertTicketSummary(list, detail({ ticketId: "new", lastMessageAt: "2026-11-06T00:00:00Z" }));
    expect(added?.tickets.map((ticket) => ticket.ticketId)).toEqual(["new", "a", "b"]);
    expect(upsertTicketSummary(undefined, detail())).toBeUndefined();
  });
});

describe("getStatusEventCopy", () => {
  it("describes who closed or reopened the ticket", () => {
    expect(getStatusEventCopy({ author: "REQUESTER", fromStatus: "OPEN", toStatus: "RESOLVED" })).toEqual({
      labelKey: "support.statusEventResolvedByYou",
    });
    expect(getStatusEventCopy({ author: "SUPPORT", fromStatus: "IN_PROGRESS", toStatus: "RESOLVED" })).toEqual({
      labelKey: "support.statusEventResolvedBySupport",
    });
    expect(getStatusEventCopy({ author: "REQUESTER", fromStatus: "RESOLVED", toStatus: "OPEN" })).toEqual({
      labelKey: "support.statusEventReopened",
    });
    expect(getStatusEventCopy({ author: "SUPPORT", fromStatus: "OPEN", toStatus: "IN_PROGRESS" })).toEqual({
      labelKey: "support.statusEventChanged",
      statusLabelKey: "support.status.IN_PROGRESS",
    });
  });
});

describe("buildThreadItems", () => {
  const now = new Date(2026, 10, 5, 12, 0, 0);

  it("orders by time, adds day lines and groups bubbles by side", () => {
    const items = buildThreadItems(
      [
        message({ messageId: "m3", author: "SUPPORT", body: "รับเรื่องแล้วค่ะ", createdAt: new Date(2026, 10, 5, 9, 0).toISOString() }),
        message({ messageId: "m1", body: "หนังสือยังไม่มา", createdAt: new Date(2026, 10, 4, 9, 0).toISOString() }),
        message({ messageId: "m2", body: "ช่วยดูให้หน่อย", createdAt: new Date(2026, 10, 4, 9, 5).toISOString() }),
        message({
          messageId: "s1",
          kind: "STATUS_CHANGE",
          author: "SUPPORT",
          body: null,
          fromStatus: "OPEN",
          toStatus: "IN_PROGRESS",
          createdAt: new Date(2026, 10, 5, 9, 0, 1).toISOString(),
        }),
        message({ messageId: "m4", author: "SUPPORT", body: "ส่งใหม่ให้แล้ว", createdAt: new Date(2026, 10, 5, 9, 1).toISOString() }),
      ],
      now,
    );

    expect(items.map((item) => (item.kind === "date" ? `date:${item.label}` : `${item.kind}:${item.key}`))).toEqual([
      "date:เมื่อวาน",
      "message:m1",
      "message:m2",
      "date:วันนี้",
      "message:m3",
      "status:s1",
      "message:m4",
    ]);
    const bubbles = items.filter((item) => item.kind === "message");
    expect(bubbles.map((item) => [item.own, item.isFirstInGroup])).toEqual([
      [true, true],
      [true, false],
      [false, true],
      // A status line breaks the run, so the team name shows again.
      [false, true],
    ]);
  });

  it("skips empty message bodies and handles no messages", () => {
    expect(buildThreadItems([message({ body: "   " })], now)).toEqual([]);
    expect(buildThreadItems(undefined, now)).toEqual([]);
  });

  it("finds the newest message id", () => {
    expect(
      getLastMessageId([
        message({ messageId: "b", createdAt: "2026-11-02T00:00:00Z" }),
        message({ messageId: "a", createdAt: "2026-11-01T00:00:00Z" }),
      ]),
    ).toBe("b");
    expect(getLastMessageId([])).toBeNull();
  });
});
