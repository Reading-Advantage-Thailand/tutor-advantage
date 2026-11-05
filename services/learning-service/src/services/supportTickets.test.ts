import { describe, expect, it } from "vitest";
import {
  adminMessageNextStatus,
  canReply,
  categoryAllowedForRole,
  computeDueAt,
  DAY_MS,
  hasUnreadReply,
  isOverdue,
  parseAdminListQuery,
  planRequesterReply,
  requesterNoticeFor,
  requesterNoticeText,
  supportStatusChange,
  toAdminTicketDetail,
  toTicketDetail,
  toTicketSummary,
  validateAdminMessage,
  validateAdminStatus,
  validateAssign,
  validateCreateTicket,
  validateRequesterReply,
  type AdminTicketRow,
  type TicketMessageRow,
} from "./supportTickets";

const KEY = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const bkk = (local: string) => new Date(`${local}+07:00`);
const endOfBkkDay = (date: string) => new Date(`${date}T23:59:59.999+07:00`);

describe("computeDueAt (Bangkok business days)", () => {
  // 2026-11-02 is a Monday.
  it.each([
    ["Monday morning, 2 days", "2026-11-02T10:00:00", "OTHER", "2026-11-04"],
    ["Monday morning, REFUND 3 days", "2026-11-02T10:00:00", "REFUND", "2026-11-05"],
    ["Thursday skips the weekend", "2026-11-05T09:00:00", "CLASS", "2026-11-09"],
    ["Thursday REFUND", "2026-11-05T09:00:00", "REFUND", "2026-11-10"],
    ["Friday lands on Tuesday", "2026-11-06T15:00:00", "TECHNICAL", "2026-11-10"],
    ["Friday REFUND lands on Wednesday", "2026-11-06T15:00:00", "REFUND", "2026-11-11"],
    ["Saturday counts from Monday", "2026-11-07T12:00:00", "OTHER", "2026-11-10"],
    ["Sunday counts from Monday", "2026-11-08T12:00:00", "OTHER", "2026-11-10"],
    ["Sunday REFUND", "2026-11-08T12:00:00", "REFUND", "2026-11-11"],
    ["Friday 23:59 Bangkok is still Friday", "2026-11-06T23:59:00", "OTHER", "2026-11-10"],
  ] as const)("%s", (_name, created, category, dueDate) => {
    expect(computeDueAt(bkk(created), category).toISOString()).toBe(endOfBkkDay(dueDate).toISOString());
  });

  it("uses the Bangkok calendar day, not UTC, after midnight Bangkok", () => {
    // Sunday 17:30 UTC = Monday 00:30 Bangkok → Monday + 2 business days = Wednesday.
    expect(computeDueAt(new Date("2026-11-08T17:30:00Z"), "OTHER")).toEqual(endOfBkkDay("2026-11-11"));
    // Thursday 23:59:59.999 Bangkok vs. Friday 00:00 Bangkok.
    expect(computeDueAt(new Date("2026-11-05T16:59:59.999Z"), "OTHER")).toEqual(endOfBkkDay("2026-11-09"));
    expect(computeDueAt(new Date("2026-11-05T17:00:00.000Z"), "OTHER")).toEqual(endOfBkkDay("2026-11-10"));
  });

  it("ends at 23:59:59.999 Bangkok (16:59:59.999Z)", () => {
    const due = computeDueAt(bkk("2026-11-02T08:00:00"), "OTHER");
    expect(due.toISOString()).toBe("2026-11-04T16:59:59.999Z");
  });
});

describe("categories per role", () => {
  it("lets students file refunds but not payouts, and tutors the reverse", () => {
    expect(categoryAllowedForRole("REFUND", "STUDENT")).toBe(true);
    expect(categoryAllowedForRole("BOOK_DAMAGED", "STUDENT")).toBe(true);
    expect(categoryAllowedForRole("PAYOUT", "STUDENT")).toBe(false);
    expect(categoryAllowedForRole("PAYOUT", "TUTOR")).toBe(true);
    expect(categoryAllowedForRole("REFUND", "TUTOR")).toBe(false);
    expect(categoryAllowedForRole("BOOK_DAMAGED", "TUTOR")).toBe(false);
    expect(categoryAllowedForRole("NOPE", "TUTOR")).toBe(false);
  });
});

describe("validateCreateTicket", () => {
  const valid = { category: "CLASS", subject: "  เปลี่ยนเวลาเรียน  ", body: "ขอเปลี่ยนเวลาเรียนวันศุกร์ค่ะ", idempotencyKey: KEY };

  it("trims and normalises a valid request", () => {
    const result = validateCreateTicket({ ...valid, classId: CLASS_ID.toUpperCase(), paymentReference: " chrg_test_5x " }, "STUDENT");
    expect(result).toEqual({
      ok: true,
      value: {
        category: "CLASS",
        subject: "เปลี่ยนเวลาเรียน",
        body: "ขอเปลี่ยนเวลาเรียนวันศุกร์ค่ะ",
        classId: CLASS_ID,
        paymentReference: "chrg_test_5x",
        idempotencyKey: KEY,
      },
    });
  });

  it("treats empty optional fields as absent", () => {
    const result = validateCreateTicket({ ...valid, classId: "", paymentReference: "  " }, "TUTOR");
    expect(result.ok && result.value.classId).toBeNull();
    expect(result.ok && result.value.paymentReference).toBeNull();
  });

  it.each([
    [{ ...valid, idempotencyKey: "abc" }, "VALIDATION_FAILED"],
    [{ ...valid, idempotencyKey: undefined }, "VALIDATION_FAILED"],
    [{ ...valid, category: "PAYOUT" }, "INVALID_CATEGORY"],
    [{ ...valid, category: 3 }, "INVALID_CATEGORY"],
    [{ ...valid, subject: " ab " }, "VALIDATION_FAILED"],
    [{ ...valid, subject: "x".repeat(121) }, "VALIDATION_FAILED"],
    [{ ...valid, body: "short" }, "VALIDATION_FAILED"],
    [{ ...valid, body: "x".repeat(4001) }, "VALIDATION_FAILED"],
    [{ ...valid, classId: "not-a-uuid" }, "VALIDATION_FAILED"],
    [{ ...valid, paymentReference: "has space" }, "VALIDATION_FAILED"],
    [{ ...valid, paymentReference: "x".repeat(65) }, "VALIDATION_FAILED"],
    [{ ...valid, paymentReference: 42 }, "VALIDATION_FAILED"],
    [null, "VALIDATION_FAILED"],
    [[valid], "VALIDATION_FAILED"],
  ])("rejects %j", (body, code) => {
    const result = validateCreateTicket(body, "STUDENT");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(code);
  });

  it("counts code points like Postgres char_length", () => {
    // Two emoji are 4 UTF-16 units but 2 characters: too short for a subject.
    expect(validateCreateTicket({ ...valid, subject: "😀😀" }, "STUDENT").ok).toBe(false);
    expect(validateCreateTicket({ ...valid, subject: "😀😀😀" }, "STUDENT").ok).toBe(true);
  });
});

describe("reply and admin validation", () => {
  it("rejects NUL and control characters but keeps tabs and newlines", () => {
    const nul = String.fromCharCode(0);
    const bell = String.fromCharCode(7);
    expect(validateRequesterReply({ body: `help${nul}`, clientMessageId: KEY }).ok).toBe(false);
    expect(validateRequesterReply({ body: `ring${bell}`, clientMessageId: KEY }).ok).toBe(false);
    expect(validateRequesterReply({ body: "line one\n\tline two\r\n", clientMessageId: KEY }).ok).toBe(true);
    expect(validateCreateTicket({ category: "CLASS", subject: `Book${nul} late`, body: "ขอเปลี่ยนเวลาเรียนวันศุกร์ค่ะ", idempotencyKey: KEY }, "STUDENT").ok).toBe(false);
    expect(validateAdminStatus({ status: "RESOLVED", note: `done${nul}` }).ok).toBe(false);
  });

  it("requires a UUID clientMessageId and a 1..4000 body", () => {
    expect(validateRequesterReply({ body: " ok ", clientMessageId: KEY })).toEqual({ ok: true, value: { body: "ok", clientMessageId: KEY } });
    expect(validateRequesterReply({ body: "   ", clientMessageId: KEY }).ok).toBe(false);
    expect(validateRequesterReply({ body: "hi", clientMessageId: "1" }).ok).toBe(false);
  });

  it("validates admin messages", () => {
    expect(validateAdminMessage({ body: "hi", clientMessageId: KEY, internal: true })).toEqual({
      ok: true,
      value: { body: "hi", clientMessageId: KEY, internal: true, status: null },
    });
    expect(validateAdminMessage({ body: "hi", clientMessageId: KEY, internal: "no" }).ok).toBe(false);
    expect(validateAdminMessage({ body: "hi", clientMessageId: KEY, internal: false, status: "CLOSED" }).ok).toBe(false);
    expect(validateAdminMessage({ body: "hi", clientMessageId: KEY, internal: false, status: "RESOLVED" })).toMatchObject({
      ok: true,
      value: { status: "RESOLVED" },
    });
  });

  it("validates status changes and notes", () => {
    expect(validateAdminStatus({ status: "RESOLVED", note: "  " })).toEqual({ ok: true, value: { status: "RESOLVED", note: null } });
    expect(validateAdminStatus({ status: "RESOLVED", note: "x".repeat(1001) }).ok).toBe(false);
    expect(validateAdminStatus({ status: "DONE" }).ok).toBe(false);
  });

  it("validates assignment", () => {
    expect(validateAssign({ assigneeUserId: null })).toEqual({ ok: true, value: { assigneeUserId: null } });
    expect(validateAssign({ assigneeUserId: KEY })).toEqual({ ok: true, value: { assigneeUserId: KEY } });
    expect(validateAssign({}).ok).toBe(false);
    expect(validateAssign({ assigneeUserId: "me" }).ok).toBe(false);
  });
});

describe("status rules", () => {
  const now = new Date("2026-11-20T00:00:00Z");

  it("overdue = unresolved, no first response, past dueAt", () => {
    const base = { status: "OPEN", firstResponseAt: null, resolvedAt: null, dueAt: new Date(now.getTime() - 1) };
    expect(isOverdue(base, now)).toBe(true);
    expect(isOverdue({ ...base, dueAt: now }, now)).toBe(false);
    expect(isOverdue({ ...base, firstResponseAt: now }, now)).toBe(false);
    expect(isOverdue({ ...base, status: "RESOLVED" }, now)).toBe(false);
  });

  it("requester replies reopen waiting and recently resolved tickets", () => {
    expect(planRequesterReply({ status: "OPEN", resolvedAt: null }, now)).toEqual({ ok: true, nextStatus: "OPEN", statusChanged: false, clearResolvedAt: false });
    expect(planRequesterReply({ status: "IN_PROGRESS", resolvedAt: null }, now)).toMatchObject({ nextStatus: "IN_PROGRESS", statusChanged: false });
    expect(planRequesterReply({ status: "WAITING_ON_REQUESTER", resolvedAt: null }, now)).toEqual({ ok: true, nextStatus: "OPEN", statusChanged: true, clearResolvedAt: false });
    const recent = new Date(now.getTime() - 14 * DAY_MS);
    expect(planRequesterReply({ status: "RESOLVED", resolvedAt: recent }, now)).toEqual({ ok: true, nextStatus: "OPEN", statusChanged: true, clearResolvedAt: true });
    const old = new Date(now.getTime() - 14 * DAY_MS - 1);
    expect(planRequesterReply({ status: "RESOLVED", resolvedAt: old }, now)).toEqual({ ok: false, code: "TICKET_CLOSED" });
    expect(canReply({ status: "RESOLVED", resolvedAt: old }, now)).toBe(false);
    expect(canReply({ status: "RESOLVED", resolvedAt: recent }, now)).toBe(true);
    expect(canReply({ status: "WAITING_ON_REQUESTER", resolvedAt: null }, now)).toBe(true);
  });

  it("support status changes stamp resolvedAt and the awaitingSupport flag", () => {
    expect(supportStatusChange("OPEN", "RESOLVED", now)).toEqual({ resolvedAt: now, awaitingSupport: false });
    expect(supportStatusChange("RESOLVED", "IN_PROGRESS", now)).toEqual({ resolvedAt: null });
    expect(supportStatusChange("RESOLVED", "OPEN", now)).toEqual({ resolvedAt: null, awaitingSupport: true });
    expect(supportStatusChange("OPEN", "WAITING_ON_REQUESTER", now)).toEqual({ awaitingSupport: false });
    expect(supportStatusChange("OPEN", "IN_PROGRESS", now)).toEqual({});
  });

  it("a public reply moves OPEN to IN_PROGRESS unless a status is given", () => {
    expect(adminMessageNextStatus("OPEN", false, null)).toBe("IN_PROGRESS");
    expect(adminMessageNextStatus("OPEN", true, null)).toBe("OPEN");
    expect(adminMessageNextStatus("OPEN", false, "WAITING_ON_REQUESTER")).toBe("WAITING_ON_REQUESTER");
    expect(adminMessageNextStatus("WAITING_ON_REQUESTER", false, null)).toBe("WAITING_ON_REQUESTER");
  });

  it("notifies the requester on replies, waiting and resolved only", () => {
    expect(requesterNoticeFor(true, "RESOLVED")).toBe("REPLY");
    expect(requesterNoticeFor(false, "RESOLVED")).toBe("RESOLVED");
    expect(requesterNoticeFor(false, "WAITING_ON_REQUESTER")).toBe("WAITING_ON_REQUESTER");
    expect(requesterNoticeFor(false, "IN_PROGRESS")).toBeNull();
    expect(requesterNoticeFor(false, null)).toBeNull();
  });

  it("notice copy never needs the ticket text", () => {
    expect(requesterNoticeText("REPLY", 12, "https://liff/x")).toBe("ทีมงานตอบคำร้อง #12 แล้ว\nดูรายละเอียด: https://liff/x");
    expect(requesterNoticeText("RESOLVED", 12, "")).toBe("คำร้อง #12 ปิดแล้ว");
  });
});

describe("parseAdminListQuery", () => {
  it("defaults to the active queue, page 1 of 20", () => {
    expect(parseAdminListQuery({})).toEqual({
      ok: true,
      value: { status: "ACTIVE", category: null, ticketNumber: null, search: null, assignee: null, overdue: false, page: 1, pageSize: 20 },
    });
  });

  it("reads #123 and 123 as a ticket number, other text as a search", () => {
    expect(parseAdminListQuery({ q: "#123" })).toMatchObject({ value: { ticketNumber: 123, search: null } });
    expect(parseAdminListQuery({ q: " 123 " })).toMatchObject({ value: { ticketNumber: 123 } });
    expect(parseAdminListQuery({ q: "9999999999" })).toMatchObject({ value: { ticketNumber: 0 } });
    expect(parseAdminListQuery({ q: "somchai@" })).toMatchObject({ value: { ticketNumber: null, search: "somchai@" } });
  });

  it("clamps paging and rejects unknown filters", () => {
    expect(parseAdminListQuery({ page: "0", pageSize: "500" })).toMatchObject({ value: { page: 1, pageSize: 100 } });
    expect(parseAdminListQuery({ status: "CLOSED" }).ok).toBe(false);
    expect(parseAdminListQuery({ category: "X" })).toMatchObject({ ok: false, code: "INVALID_CATEGORY" });
    expect(parseAdminListQuery({ assignee: "bob" }).ok).toBe(false);
    expect(parseAdminListQuery({ status: "RESOLVED", assignee: "me", overdue: "true" })).toMatchObject({
      value: { status: "RESOLVED", assignee: "me", overdue: true },
    });
  });
});

describe("views", () => {
  const t0 = new Date("2026-11-02T03:00:00Z");
  const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
  const ticket: AdminTicketRow = {
    ticketId: "33333333-3333-4333-8333-333333333333",
    ticketNumber: 7,
    requesterUserId: "44444444-4444-4444-8444-444444444444",
    requesterRole: "STUDENT",
    category: "CLASS",
    subject: "เวลาเรียน",
    status: "IN_PROGRESS",
    awaitingSupport: false,
    classId: CLASS_ID,
    paymentReference: null,
    assigneeUserId: null,
    idempotencyKey: KEY,
    dueAt: at(60 * 48),
    firstResponseAt: at(30),
    resolvedAt: null,
    requesterLastReadAt: at(10),
    lastMessageAt: at(30),
    createdAt: t0,
    updatedAt: at(30),
    class: { title: "English A" },
    requester: { userId: "44444444-4444-4444-8444-444444444444", displayName: "Nok", role: "STUDENT", email: "nok@example.com" },
    assignee: null,
  } as AdminTicketRow;
  const messages: TicketMessageRow[] = [
    { messageId: "m3", authorUserId: "admin", authorSide: "SUPPORT", kind: "MESSAGE", body: "ได้ครับ", fromStatus: null, toStatus: null, createdAt: at(30), author: { displayName: "Admin A" } },
    { messageId: "m1", authorUserId: ticket.requesterUserId, authorSide: "REQUESTER", kind: "MESSAGE", body: "ขอเปลี่ยนเวลา", fromStatus: null, toStatus: null, createdAt: t0, author: { displayName: "Nok" } },
    { messageId: "m2", authorUserId: "admin", authorSide: "SUPPORT", kind: "INTERNAL_NOTE", body: "check tutor", fromStatus: null, toStatus: null, createdAt: at(20), author: { displayName: "Admin A" } },
  ];

  it("requester detail hides internal notes and admin names, oldest first", () => {
    const detail = toTicketDetail(ticket, messages, at(40));
    expect(detail.messages.map((m) => m.messageId)).toEqual(["m1", "m3"]);
    expect(detail.messages[1]).toEqual({
      messageId: "m3",
      kind: "MESSAGE",
      author: "SUPPORT",
      body: "ได้ครับ",
      fromStatus: null,
      toStatus: null,
      createdAt: at(30).toISOString(),
    });
    expect(JSON.stringify(detail)).not.toContain("Admin A");
    expect(JSON.stringify(detail)).not.toContain("check tutor");
    expect(detail).toMatchObject({ classTitle: "English A", canReply: true, hasUnreadReply: true, resolvedAt: null });
  });

  it("hasUnreadReply ignores requester and internal entries", () => {
    expect(hasUnreadReply(messages, at(30))).toBe(false);
    expect(hasUnreadReply(messages, null)).toBe(true);
    expect(hasUnreadReply([messages[1], messages[2]], null)).toBe(false);
    expect(hasUnreadReply([{ authorSide: "SUPPORT", kind: "STATUS_CHANGE", createdAt: at(50) }], at(40))).toBe(true);
    expect(toTicketSummary({ ...ticket, requesterLastReadAt: at(31) }, messages).hasUnreadReply).toBe(false);
  });

  it("admin detail keeps every entry with author names", () => {
    const detail = toAdminTicketDetail(ticket, messages, at(40));
    expect(detail.messages.map((m) => [m.messageId, m.kind, m.authorName])).toEqual([
      ["m1", "MESSAGE", "Nok"],
      ["m2", "INTERNAL_NOTE", "Admin A"],
      ["m3", "MESSAGE", "Admin A"],
    ]);
    expect(detail).toMatchObject({
      requester: { userId: ticket.requesterUserId, displayName: "Nok", role: "STUDENT", email: "nok@example.com" },
      assignee: null,
      overdue: false,
      awaitingSupport: false,
      dueAt: at(60 * 48).toISOString(),
      classTitle: "English A",
    });
  });
});
