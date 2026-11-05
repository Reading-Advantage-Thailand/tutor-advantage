import { describe, expect, it } from "vitest";
import {
  assignActions,
  buildMessagePayload,
  buildQueueQuery,
  buildThread,
  dueState,
  formatTicketNumber,
  isQueueFiltered,
  newClientMessageId,
  clientMessageIdFor,
  draftAttemptKey,
  parseStatusTab,
  REPLY_MAX,
  statusAfterReply,
  statusTargets,
  tabCount,
  threadItemKind,
  ticketDetailKey,
  ticketsListPrefix,
  validateComposer,
  type AdminMessage,
} from "./ticketModel";

const NOW = new Date("2026-11-05T05:00:00.000Z");

function message(overrides: Partial<AdminMessage>): AdminMessage {
  return {
    messageId: "m1",
    kind: "MESSAGE",
    author: "REQUESTER",
    authorName: "นักเรียน ก",
    body: "สวัสดีครับ",
    fromStatus: null,
    toStatus: null,
    createdAt: "2026-11-05T01:00:00.000Z",
    ...overrides,
  };
}

describe("ticket queue query", () => {
  it("defaults to the ACTIVE tab, page 1 and 20 rows", () => {
    expect(buildQueueQuery({})).toEqual({ status: "ACTIVE", page: 1, pageSize: 20 });
    expect(parseStatusTab("CLOSED")).toBe("ACTIVE");
    expect(parseStatusTab("WAITING_ON_REQUESTER")).toBe("WAITING_ON_REQUESTER");
  });

  it("keeps known filters, drops unknown values and trims search", () => {
    expect(
      buildQueueQuery({
        status: "RESOLVED",
        category: "REFUND",
        assignee: "me",
        overdue: "true",
        q: "  #42 ",
        page: 3,
        pageSize: 50,
      }),
    ).toEqual({ status: "RESOLVED", category: "REFUND", assignee: "me", overdue: "true", q: "#42", page: 3, pageSize: 50 });
    expect(buildQueueQuery({ category: "NOPE", assignee: "someone", overdue: "1", q: "   " })).toEqual({
      status: "ACTIVE",
      page: 1,
      pageSize: 20,
    });
    expect(buildQueueQuery({ overdue: true, pageSize: 500, page: 0 })).toMatchObject({ overdue: "true", pageSize: 100, page: 1 });
  });

  it("knows when the queue is filtered", () => {
    expect(isQueueFiltered(buildQueueQuery({}))).toBe(false);
    expect(isQueueFiltered(buildQueueQuery({ status: "OPEN" }))).toBe(true);
    expect(isQueueFiltered(buildQueueQuery({ assignee: "unassigned" }))).toBe(true);
    expect(isQueueFiltered(buildQueueQuery({ q: "refund" }))).toBe(true);
  });

  it("reads tab counts, hidden while loading", () => {
    const counts = { ACTIVE: 7, OPEN: 3, IN_PROGRESS: 2, WAITING_ON_REQUESTER: 2, RESOLVED: 40, overdue: 1, awaitingSupport: 4 };
    expect(tabCount(undefined, "OPEN")).toBeUndefined();
    expect(tabCount(counts, "ACTIVE")).toBe(7);
    expect(tabCount(counts, "RESOLVED")).toBe(40);
  });

  it("prefixes cache keys with the admin id", () => {
    expect(ticketDetailKey("a1", "t1").startsWith("a1:tickets:")).toBe(true);
    expect(ticketsListPrefix("a1")).toBe("a1:tickets:list:");
    expect(ticketDetailKey("a1", "t1").startsWith(ticketsListPrefix("a1"))).toBe(false);
  });
});

describe("ticket display", () => {
  it("formats the human ticket number", () => {
    expect(formatTicketNumber(123)).toBe("#123");
    expect(formatTicketNumber(null)).toBe("#–");
  });

  it("derives the first-response due state", () => {
    const base = { status: "OPEN", firstResponseAt: null, overdue: false };
    expect(dueState({ ...base, dueAt: "2026-11-05T04:59:59.000Z" }, NOW)).toBe("overdue");
    expect(dueState({ ...base, dueAt: "2026-11-09T16:59:59.999Z", overdue: true }, NOW)).toBe("overdue");
    expect(dueState({ ...base, dueAt: "2026-11-05T20:00:00.000Z" }, NOW)).toBe("soon");
    expect(dueState({ ...base, dueAt: "2026-11-09T16:59:59.999Z" }, NOW)).toBe("pending");
    expect(dueState({ ...base, dueAt: "2026-11-01T00:00:00.000Z", firstResponseAt: "2026-11-02T00:00:00.000Z" }, NOW)).toBe(
      "answered",
    );
    expect(dueState({ ...base, status: "RESOLVED", dueAt: "2026-11-01T00:00:00.000Z" }, NOW)).toBe("resolved");
  });
});

describe("ticket thread", () => {
  it("tags requester, support, internal notes and status events", () => {
    expect(threadItemKind({ kind: "MESSAGE", author: "REQUESTER" })).toBe("requester");
    expect(threadItemKind({ kind: "MESSAGE", author: "SUPPORT" })).toBe("support");
    expect(threadItemKind({ kind: "INTERNAL_NOTE", author: "SUPPORT" })).toBe("internal");
    expect(threadItemKind({ kind: "STATUS_CHANGE", author: "REQUESTER" })).toBe("event");
  });

  it("orders oldest first and keeps the server order for equal timestamps", () => {
    const thread = buildThread([
      message({ messageId: "c", createdAt: "2026-11-05T03:00:00.000Z", kind: "INTERNAL_NOTE", author: "SUPPORT" }),
      message({ messageId: "a", createdAt: "2026-11-05T01:00:00.000Z" }),
      message({ messageId: "b1", createdAt: "2026-11-05T02:00:00.000Z", author: "SUPPORT", authorName: "แอดมิน" }),
      message({
        messageId: "b2",
        createdAt: "2026-11-05T02:00:00.000Z",
        kind: "STATUS_CHANGE",
        author: "SUPPORT",
        body: null,
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
      }),
    ]);
    expect(thread.map((item) => [item.id, item.kind])).toEqual([
      ["a", "requester"],
      ["b1", "support"],
      ["b2", "event"],
      ["c", "internal"],
    ]);
    expect(thread[2]).toMatchObject({ fromStatus: "OPEN", toStatus: "IN_PROGRESS", byRequester: false });
  });
});

describe("ticket composer", () => {
  it("validates the body length and the optional status", () => {
    expect(validateComposer({ body: "   ", internal: false, status: "" })).toBe("EMPTY");
    expect(validateComposer({ body: "x".repeat(REPLY_MAX + 1), internal: false, status: "" })).toBe("TOO_LONG");
    expect(validateComposer({ body: ` ${"x".repeat(REPLY_MAX)} `, internal: true, status: "" })).toBeNull();
    expect(validateComposer({ body: "ok", internal: false, status: "CLOSED" })).toBe("INVALID_STATUS");
    expect(validateComposer({ body: "ok", internal: false, status: "WAITING_ON_REQUESTER" })).toBeNull();
  });

  it("builds the message payload and only sends a status that changes the ticket", () => {
    expect(buildMessagePayload({ body: "  ตอบแล้ว  ", internal: false, status: "" }, "OPEN", "cid-1")).toEqual({
      body: "ตอบแล้ว",
      internal: false,
      clientMessageId: "cid-1",
    });
    expect(buildMessagePayload({ body: "x", internal: false, status: "RESOLVED" }, "OPEN", "cid-2")).toEqual({
      body: "x",
      internal: false,
      clientMessageId: "cid-2",
      status: "RESOLVED",
    });
    expect(buildMessagePayload({ body: "x", internal: true, status: "IN_PROGRESS" }, "IN_PROGRESS", "cid-3")).not.toHaveProperty(
      "status",
    );
  });

  it("predicts the status after sending", () => {
    expect(statusAfterReply("OPEN", { internal: false, status: "" })).toBe("IN_PROGRESS");
    expect(statusAfterReply("OPEN", { internal: true, status: "" })).toBe("OPEN");
    expect(statusAfterReply("OPEN", { internal: false, status: "WAITING_ON_REQUESTER" })).toBe("WAITING_ON_REQUESTER");
    expect(statusAfterReply("WAITING_ON_REQUESTER", { internal: false, status: "" })).toBe("WAITING_ON_REQUESTER");
  });

  it("offers every other status as a button", () => {
    expect(statusTargets("OPEN")).toEqual(["IN_PROGRESS", "WAITING_ON_REQUESTER", "RESOLVED"]);
    expect(statusTargets("RESOLVED")).toEqual(["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER"]);
  });
});

describe("ticket assignment", () => {
  it("offers assign-to-me unless already mine, and unassign when assigned", () => {
    expect(assignActions(null, "me")).toEqual({ canAssignToMe: true, canUnassign: false, assignedToMe: false });
    expect(assignActions({ userId: "me", displayName: "ฉัน" }, "me")).toEqual({
      canAssignToMe: false,
      canUnassign: true,
      assignedToMe: true,
    });
    expect(assignActions({ userId: "other", displayName: "คนอื่น" }, "me")).toEqual({
      canAssignToMe: true,
      canUnassign: true,
      assignedToMe: false,
    });
    expect(assignActions(null, null).canAssignToMe).toBe(false);
  });
});

describe("client message ids", () => {
  it("reuses a pending id only for the identical draft", () => {
    const draft = { body: " ตรวจสอบแล้วครับ ", internal: false, status: "" };
    const key = draftAttemptKey(draft, "OPEN");
    const pending = { key, clientMessageId: "pending-id" };
    const fresh = () => "fresh-id";
    expect(clientMessageIdFor(null, key, fresh)).toBe("fresh-id");
    // Whitespace-only differences are the same payload.
    expect(clientMessageIdFor(pending, draftAttemptKey({ ...draft, body: "ตรวจสอบแล้วครับ" }, "OPEN"), fresh)).toBe("pending-id");
    expect(clientMessageIdFor(pending, draftAttemptKey({ ...draft, body: "แก้ข้อความ" }, "OPEN"), fresh)).toBe("fresh-id");
    expect(clientMessageIdFor(pending, draftAttemptKey({ ...draft, internal: true }, "OPEN"), fresh)).toBe("fresh-id");
    expect(clientMessageIdFor(pending, draftAttemptKey({ ...draft, status: "RESOLVED" }, "OPEN"), fresh)).toBe("fresh-id");
  });

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("uses crypto.randomUUID when available", () => {
    expect(newClientMessageId({ randomUUID: () => "3b241101-e2bb-4255-8caf-4136c566a962" })).toBe("3b241101-e2bb-4255-8caf-4136c566a962");
    expect(newClientMessageId()).toMatch(UUID);
  });

  it("falls back to a v4 UUID built from random bytes", () => {
    expect(newClientMessageId({ getRandomValues: (array) => array.fill(255) })).toMatch(UUID);
    expect(newClientMessageId({})).toMatch(UUID);
  });
});
