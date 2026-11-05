import { describe, expect, it } from "vitest";
import {
  BODY_MAX,
  TUTOR_TICKET_CATEGORIES,
  buildCreateTicketRequest,
  categoryLabel,
  createClientId,
  draftFromSearchParams,
  formatTicketNumber,
  getSupportErrorMessage,
  isValidTicketId,
  splitTickets,
  statusChangeText,
  statusLabel,
  statusToneFor,
  ticketStateNotice,
  validateReply,
  validateTicketDraft,
} from "./support";

const CLASS_ID = "8a0c3f4e-1b2d-4c5e-9f60-718293a4b5c6";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("categories and statuses", () => {
  it("offers only the tutor categories, in contract order", () => {
    expect(TUTOR_TICKET_CATEGORIES).toEqual(["BOOK_DELIVERY", "CLASS", "PAYOUT", "PRIVACY", "TECHNICAL", "OTHER"]);
  });

  it("uses the contract's Thai labels", () => {
    expect(categoryLabel("PAYOUT")).toBe("การจ่ายเงินติวเตอร์");
    expect(categoryLabel("BOOK_DELIVERY")).toBe("หนังสือยังไม่ได้รับ/ส่งช้า");
    expect(categoryLabel("nope")).toBe("อื่นๆ");
    expect(statusLabel("OPEN")).toBe("รอทีมงาน");
    expect(statusLabel("IN_PROGRESS")).toBe("กำลังดำเนินการ");
    expect(statusLabel("WAITING_ON_REQUESTER")).toBe("รอข้อมูลจากคุณ");
    expect(statusLabel("RESOLVED")).toBe("ปิดแล้ว");
  });

  it("highlights tickets waiting on the tutor", () => {
    expect(statusToneFor("WAITING_ON_REQUESTER")).toBe("warning");
    expect(statusToneFor("OPEN")).toBe("info");
    expect(statusToneFor("RESOLVED")).toBe("neutral");
  });

  it("formats status changes and ticket numbers", () => {
    expect(statusChangeText({ toStatus: "RESOLVED" })).toBe("สถานะเปลี่ยนเป็น “ปิดแล้ว”");
    expect(formatTicketNumber(123)).toBe("#123");
    expect(formatTicketNumber(undefined)).toBe("#–");
  });
});

describe("validateTicketDraft", () => {
  const valid = { category: "CLASS", classId: "", subject: "เลื่อนคลาส", body: "ขอเลื่อนคลาสวันศุกร์นี้ครับ" };

  it("accepts a complete draft", () => {
    expect(validateTicketDraft(valid)).toEqual({});
  });

  it("rejects student-only categories and out-of-range lengths (after trimming)", () => {
    const errors = validateTicketDraft({ category: "REFUND", classId: "", subject: "  ab  ", body: "short     " });
    expect(Object.keys(errors).sort()).toEqual(["body", "category", "subject"]);
    expect(errors.subject).toBe("หัวข้อต้องมี 3-120 ตัวอักษร");
    expect(errors.body).toBe("รายละเอียดต้องมี 10-4000 ตัวอักษร");
    expect(validateTicketDraft({ ...valid, body: "x".repeat(BODY_MAX + 1) }).body).toBeDefined();
  });
});

describe("buildCreateTicketRequest", () => {
  it("trims text and only sends a real class id", () => {
    const draft = { category: "CLASS", classId: CLASS_ID, subject: " หัวข้อ ", body: " รายละเอียดคำร้อง " };
    expect(buildCreateTicketRequest(draft, "key-1")).toEqual({
      category: "CLASS",
      subject: "หัวข้อ",
      body: "รายละเอียดคำร้อง",
      classId: CLASS_ID,
      idempotencyKey: "key-1",
    });
    expect(buildCreateTicketRequest({ ...draft, classId: "" }, "key-1")).not.toHaveProperty("classId");
  });
});

describe("validateReply", () => {
  it("requires 1..4000 characters", () => {
    expect(validateReply("   ")).toBe("กรุณาพิมพ์ข้อความ");
    expect(validateReply("x".repeat(4001))).toBe("ข้อความยาวได้ไม่เกิน 4000 ตัวอักษร");
    expect(validateReply("ok")).toBeNull();
  });
});

describe("getSupportErrorMessage", () => {
  it("maps contract codes to Thai and unknown codes to the fallback", () => {
    expect(getSupportErrorMessage("TOO_MANY_OPEN_TICKETS")).toContain("5 รายการ");
    expect(getSupportErrorMessage("TICKET_CLOSED")).toContain("14 วัน");
    expect(getSupportErrorMessage("CLASS_NOT_ACCESSIBLE")).toContain("คลาส");
    expect(getSupportErrorMessage("SUPPORT_REQUEST_FAILED")).toBe("ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    expect(getSupportErrorMessage(undefined)).toBe("ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  });
});

describe("ticketStateNotice", () => {
  it("explains waiting, reopenable and closed tickets", () => {
    expect(ticketStateNotice({ status: "OPEN", canReply: true })).toBeNull();
    expect(ticketStateNotice({ status: "WAITING_ON_REQUESTER", canReply: true })?.tone).toBe("warning");
    expect(ticketStateNotice({ status: "RESOLVED", canReply: true })?.text).toContain("เปิดคำร้องอีกครั้ง");
    expect(ticketStateNotice({ status: "RESOLVED", canReply: false })?.text).toContain("ส่งคำร้องใหม่");
  });
});

describe("helpers", () => {
  it("validates UUID ids", () => {
    expect(isValidTicketId(CLASS_ID)).toBe(true);
    expect(isValidTicketId("../v1/admin")).toBe(false);
    expect(isValidTicketId(undefined)).toBe(false);
  });

  it("creates distinct v4 UUIDs", () => {
    const a = createClientId();
    const b = createClientId();
    expect(a).toMatch(UUID_V4);
    expect(b).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });

  it("splits active and resolved tickets keeping order", () => {
    const tickets = [{ status: "RESOLVED" as const, n: 1 }, { status: "OPEN" as const, n: 2 }, { status: "IN_PROGRESS" as const, n: 3 }];
    const { active, resolved } = splitTickets(tickets);
    expect(active.map((ticket) => ticket.n)).toEqual([2, 3]);
    expect(resolved.map((ticket) => ticket.n)).toEqual([1]);
  });

  it("prefills only tutor categories and real ids", () => {
    expect(draftFromSearchParams({ category: "PAYOUT", classId: CLASS_ID })).toEqual({ category: "PAYOUT", classId: CLASS_ID });
    expect(draftFromSearchParams({ category: "REFUND", classId: "abc" })).toEqual({ category: "", classId: "" });
  });
});
