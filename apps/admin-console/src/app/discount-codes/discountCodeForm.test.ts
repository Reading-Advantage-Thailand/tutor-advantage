import { describe, expect, it } from "vitest";
import type { AdminClass } from "../classes/classForm";
import {
  isVoidable,
  latestRedeemer,
  listQuery,
  readCreateRequest,
  redeemerLabel,
  redemptionPhone,
  validateDiscountCodeForm,
  withoutCreateParam,
  type DiscountCodeRedeemer,
} from "./discountCodeForm";

const messages = {
  classRequired: "class",
  classDemo: "demo",
  quantity: "quantity",
  noteTooLong: "note",
  expiryIncomplete: "incomplete",
  expiryInvalid: "invalid",
  expiryPast: "past",
};
// 2 Nov 2026 10:00 Bangkok
const now = new Date("2026-11-02T03:00:00Z");
const classId = "5eed0000-0000-4000-8000-00000000c1a5";
const englishClass: AdminClass = {
  classId,
  title: "English",
  status: "OPEN",
  isDemo: false,
  bookId: "5eed0000-0000-4000-8000-0000000b0001",
  bookCode: "Primary Origins 2",
  bookTitle: "Primary Origins 2 (A1)",
  packagePriceSatang: 300_000,
  capacity: 30,
  enrolledCount: 0,
  activeStudents: 0,
  scheduleDescription: null,
  setupRequired: true,
  setupRequiredAt: "2026-11-02T02:00:00.000Z",
  createdAt: "2026-11-02T02:00:00.000Z",
  tutor: { userId: "t1", displayName: "T.นกเอี้ยง", email: "kasamphon63@gmail.com", pendingRegistration: true },
};
const base = { classOption: englishClass, quantity: "1", expiry: { day: "", month: "", yearBE: "" }, note: "" };

describe("validateDiscountCodeForm", () => {
  it("builds the minimal batch body: one code, no expiry, no note", () => {
    expect(validateDiscountCodeForm(base, messages, { now })).toEqual({ errors: {}, body: { classId, quantity: 1 } });
  });

  it("sends the Bangkok end of day as expiry and a trimmed note", () => {
    const result = validateDiscountCodeForm(
      { ...base, quantity: " 25 ", note: " โอนเงินแล้ว ", expiry: { day: "2", month: "11", yearBE: "2569" } },
      messages,
      { now },
    );
    expect(result.body).toEqual({
      classId,
      quantity: 25,
      expiresAt: "2026-11-02T16:59:59.999Z",
      note: "โอนเงินแล้ว",
    });
  });

  it("requires a non-demo class", () => {
    expect(validateDiscountCodeForm({ ...base, classOption: null }, messages, { now })).toEqual({
      errors: { class: "class" },
      body: null,
    });
    expect(validateDiscountCodeForm({ ...base, classOption: { ...englishClass, isDemo: true } }, messages, { now }).errors.class).toBe(
      "demo",
    );
  });

  it("limits the number of codes to whole numbers 1–100", () => {
    for (const quantity of ["", " ", "0", "00", "1.5", "-1", "101", "500", "1e2", "abc"]) {
      const result = validateDiscountCodeForm({ ...base, quantity }, messages, { now });
      expect(result.errors.quantity, quantity).toBe("quantity");
      expect(result.body, quantity).toBeNull();
    }
    expect(validateDiscountCodeForm({ ...base, quantity: "100" }, messages, { now }).body?.quantity).toBe(100);
    expect(validateDiscountCodeForm({ ...base, quantity: "007" }, messages, { now }).body?.quantity).toBe(7);
  });

  it("never sends a per-code use count: every code in a batch is single-use", () => {
    const body = validateDiscountCodeForm({ ...base, quantity: "20" }, messages, { now }).body;
    expect(body).toEqual({ classId, quantity: 20 });
    expect(body).not.toHaveProperty("maxRedemptions");
  });

  it("validates note length and expiry", () => {
    expect(validateDiscountCodeForm({ ...base, note: "x".repeat(501) }, messages, { now }).errors.note).toBe("note");
    expect(
      validateDiscountCodeForm({ ...base, expiry: { day: "1", month: "11", yearBE: "2569" } }, messages, { now }).errors.expiry,
    ).toBe("past");
    expect(
      validateDiscountCodeForm({ ...base, expiry: { day: "1", month: "", yearBE: "2569" } }, messages, { now }).errors.expiry,
    ).toBe("incomplete");
  });
});

describe("deep link from /classes", () => {
  it("reads ?create=1&classId= and ignores a non-UUID class id", () => {
    expect(readCreateRequest(new URLSearchParams(`create=1&classId=${classId}`))).toEqual({ classId });
    expect(readCreateRequest(new URLSearchParams("create=1&classId=../x"))).toEqual({ classId: null });
    expect(readCreateRequest(new URLSearchParams(`classId=${classId}`))).toBeNull();
    expect(readCreateRequest(null)).toBeNull();
  });

  it("drops only the create flag so the class filter stays", () => {
    expect(withoutCreateParam(`create=1&classId=${classId}&status=ACTIVE`)).toBe(`classId=${classId}&status=ACTIVE`);
  });
});

const redeemer = (overrides: Partial<DiscountCodeRedeemer> = {}): DiscountCodeRedeemer => ({
  studentUserId: "5eed0000-0000-4000-8000-0000000057d1",
  studentName: "น้องมะลิ",
  studentEmail: "mali@example.com",
  studentPhone: "0812345678",
  redeemedAt: "2026-11-02T05:30:00.000Z",
  ...overrides,
});

describe("who used a code", () => {
  it("names the student, falling back to email, then phone, then nothing", () => {
    expect(redeemerLabel(redeemer())).toBe("น้องมะลิ");
    expect(redeemerLabel(redeemer({ studentName: null }))).toBe("mali@example.com");
    expect(redeemerLabel(redeemer({ studentName: "  ", studentEmail: null }))).toBe("0812345678");
    expect(redeemerLabel(redeemer({ studentName: null, studentEmail: null, studentPhone: null }))).toBeNull();
  });

  it("shows the newest redeemer and counts the others for +n", () => {
    const newest = redeemer({ studentUserId: "s3" });
    expect(latestRedeemer({ redeemers: [], redeemedCount: 0 })).toEqual({ latest: null, others: 0 });
    expect(latestRedeemer({ redeemers: [newest], redeemedCount: 1 })).toEqual({ latest: newest, others: 0 });
    // Only the newest 3 come with the list; the count covers everyone.
    expect(latestRedeemer({ redeemers: [newest, redeemer({ studentUserId: "s2" }), redeemer()], redeemedCount: 12 })).toEqual({
      latest: newest,
      others: 11,
    });
  });

  it("tolerates a list row without redeemers (older finance version)", () => {
    const legacy = { redeemedCount: 2 } as unknown as Parameters<typeof latestRedeemer>[0];
    expect(latestRedeemer(legacy)).toEqual({ latest: null, others: 0 });
    expect(redemptionPhone({ studentUserId: "s1" }, legacy as never)).toBeNull();
  });

  it("takes the phone from the redemption, else from the code's redeemers", () => {
    const code = { redeemers: [redeemer({ studentUserId: "s1", studentPhone: "0899999999" })] };
    expect(redemptionPhone({ studentUserId: "s1", studentPhone: "0811111111" }, code)).toBe("0811111111");
    expect(redemptionPhone({ studentUserId: "s1" }, code)).toBe("0899999999");
    expect(redemptionPhone({ studentUserId: "s2", studentPhone: null }, code)).toBeNull();
    expect(redemptionPhone({ studentUserId: "s1" }, null)).toBeNull();
  });
});

describe("list helpers", () => {
  it("never sends a malformed class filter", () => {
    expect(listQuery({ page: 1, classId })).toEqual({ page: 1, classId });
    expect(listQuery({ page: 1, classId: "abc" })).toEqual({ page: 1 });
    expect(listQuery({ page: 2 })).toEqual({ page: 2 });
  });

  it("offers void only while a code can still be used", () => {
    expect(isVoidable({ status: "ACTIVE" })).toBe(true);
    for (const status of ["USED_UP", "EXPIRED", "VOID"] as const) expect(isVoidable({ status })).toBe(false);
  });
});
