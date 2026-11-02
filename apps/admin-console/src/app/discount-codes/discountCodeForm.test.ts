import { describe, expect, it } from "vitest";
import type { AdminClass } from "../classes/classForm";
import {
  canEditOfflinePaid,
  classPriceBahtInput,
  isVoidable,
  latestRedeemer,
  listQuery,
  OFFLINE_PAID_MAX_SATANG,
  offlinePaidAttempt,
  offlinePaidEditDefault,
  offlinePaidOf,
  offlinePaidWarning,
  parseOfflinePaidBaht,
  readCreateRequest,
  redeemerLabel,
  redemptionAmount,
  redemptionPhone,
  satangToBahtInput,
  validateDiscountCodeForm,
  withClassOption,
  withoutCreateParam,
  type DiscountCodeRedeemer,
} from "./discountCodeForm";

const messages = {
  classRequired: "class",
  classDemo: "demo",
  offlinePaid: "offlinePaid",
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
const base = {
  classOption: englishClass,
  offlinePaid: "3,000",
  quantity: "1",
  expiry: { day: "", month: "", yearBE: "" },
  note: "",
};

describe("validateDiscountCodeForm", () => {
  it("builds the minimal batch body: one code, the amount paid, no expiry, no note", () => {
    expect(validateDiscountCodeForm(base, messages, { now })).toEqual({
      errors: {},
      body: { classId, quantity: 1, offlinePaidSatang: 300_000 },
    });
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
      offlinePaidSatang: 300_000,
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
    expect(body).toEqual({ classId, quantity: 20, offlinePaidSatang: 300_000 });
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

describe("amount the student paid outside the app", () => {
  it("parses baht to satang: separators, ฿, two decimals, 0 for a free code", () => {
    expect(parseOfflinePaidBaht("3,000")).toBe(300_000);
    expect(parseOfflinePaidBaht(" 3000 ")).toBe(300_000);
    expect(parseOfflinePaidBaht("฿3,000")).toBe(300_000);
    expect(parseOfflinePaidBaht("2,999.5")).toBe(299_950);
    expect(parseOfflinePaidBaht("2999.50")).toBe(299_950);
    expect(parseOfflinePaidBaht("0.01")).toBe(1);
    expect(parseOfflinePaidBaht("0")).toBe(0);
    expect(parseOfflinePaidBaht("0.00")).toBe(0);
    expect(parseOfflinePaidBaht("10,000")).toBe(OFFLINE_PAID_MAX_SATANG);
    expect(parseOfflinePaidBaht("10000.00")).toBe(1_000_000);
  });

  it("rejects empty, negative, malformed and over-the-cap amounts (never guesses)", () => {
    for (const input of ["", "  ", "-1", "10,000.01", "10001", "1.234", "1e3", "abc", "3,000 บาท", ".5", "5.", "1..2", "999999999999"]) {
      expect(parseOfflinePaidBaht(input), input).toBeNull();
    }
  });

  it("formats satang for the field and round-trips through the parser", () => {
    expect(satangToBahtInput(300_000)).toBe("3,000");
    expect(satangToBahtInput(299_950)).toBe("2,999.50");
    expect(satangToBahtInput(1_000_000)).toBe("10,000");
    expect(satangToBahtInput(5)).toBe("0.05");
    expect(satangToBahtInput(0)).toBe("0");
    for (const bad of [null, undefined, -100, 1.5, Number.NaN]) expect(satangToBahtInput(bad), String(bad)).toBe("");
    for (const satang of [0, 1, 99, 100, 299_950, 300_000, 1_000_000]) {
      expect(parseOfflinePaidBaht(satangToBahtInput(satang)), String(satang)).toBe(satang);
    }
  });

  it("prefills the class price until the admin types an amount", () => {
    const blank = { ...base, classOption: null, offlinePaid: "" };
    expect(classPriceBahtInput(englishClass)).toBe("3,000");
    expect(classPriceBahtInput({ packagePriceSatang: 0 })).toBe("");
    expect(classPriceBahtInput(null)).toBe("");

    // Picking a class fills its price.
    const picked = withClassOption(blank, englishClass, false);
    expect(picked).toMatchObject({ classOption: englishClass, offlinePaid: "3,000" });
    // Another class (not typed yet) follows the new price, including satang.
    const other = { ...englishClass, classId: "c2", packagePriceSatang: 249_950 };
    expect(withClassOption(picked, other, false).offlinePaid).toBe("2,499.50");
    // Clearing the class clears the untouched amount.
    expect(withClassOption(picked, null, false)).toMatchObject({ classOption: null, offlinePaid: "" });
    // A typed amount (also "0" for a free code) is never overwritten.
    expect(withClassOption({ ...picked, offlinePaid: "2,500" }, other, true)).toMatchObject({ classOption: other, offlinePaid: "2,500" });
    expect(withClassOption({ ...blank, offlinePaid: "0" }, englishClass, true).offlinePaid).toBe("0");
  });

  it("requires the amount and sends it in satang; 0 is a deliberate free code", () => {
    expect(validateDiscountCodeForm({ ...base, offlinePaid: "0" }, messages, { now }).body?.offlinePaidSatang).toBe(0);
    expect(validateDiscountCodeForm({ ...base, offlinePaid: "2,999.50" }, messages, { now }).body?.offlinePaidSatang).toBe(299_950);
    expect(validateDiscountCodeForm({ ...base, offlinePaid: "10,000" }, messages, { now }).body?.offlinePaidSatang).toBe(1_000_000);
    for (const offlinePaid of ["", "-5", "10,001", "abc"]) {
      const result = validateDiscountCodeForm({ ...base, offlinePaid }, messages, { now });
      expect(result.errors.offlinePaid, offlinePaid).toBe("offlinePaid");
      expect(result.body, offlinePaid).toBeNull();
    }
  });

  it("warns on the review step about a free code or an amount other than the class price", () => {
    expect(offlinePaidWarning(0, 300_000)).toBe("free");
    expect(offlinePaidWarning(250_000, 300_000)).toBe("differs");
    expect(offlinePaidWarning(300_000, 300_000)).toBeNull();
    expect(offlinePaidWarning(300_000, null)).toBeNull();
  });

  it("reads the recorded amount of a code: null and older finance versions are free", () => {
    expect(offlinePaidOf({ offlinePaidSatang: 300_000 })).toBe(300_000);
    expect(offlinePaidOf({ offlinePaidSatang: 0 })).toBe(0);
    expect(offlinePaidOf({ offlinePaidSatang: null })).toBe(0);
    expect(offlinePaidOf({})).toBe(0);
  });

  it("offers แก้ยอดที่รับ only for an active code nobody used", () => {
    expect(canEditOfflinePaid({ status: "ACTIVE", redeemedCount: 0 })).toBe(true);
    expect(canEditOfflinePaid({ status: "ACTIVE", redeemedCount: 1 })).toBe(false);
    for (const status of ["USED_UP", "EXPIRED", "VOID"] as const) {
      expect(canEditOfflinePaid({ status, redeemedCount: 0 }), status).toBe(false);
    }
  });

  it("starts the edit field from the recorded amount, else the class price for an older free code", () => {
    expect(offlinePaidEditDefault({ offlinePaidSatang: 250_000, packagePriceSatang: 300_000 })).toBe("2,500");
    expect(offlinePaidEditDefault({ offlinePaidSatang: 0, packagePriceSatang: 300_000 })).toBe("0");
    expect(offlinePaidEditDefault({ offlinePaidSatang: null, packagePriceSatang: 300_000 })).toBe("3,000");
    expect(offlinePaidEditDefault({ packagePriceSatang: null })).toBe("");
  });

  it("reuses the Idempotency-Key only for a retry of the same amount", () => {
    let n = 0;
    const newKey = () => `key-${++n}`;
    const first = offlinePaidAttempt(null, 300_000, newKey);
    expect(first).toEqual({ satang: 300_000, key: "key-1" });
    expect(offlinePaidAttempt(first, 300_000, newKey)).toBe(first);
    expect(offlinePaidAttempt(first, 250_000, newKey)).toEqual({ satang: 250_000, key: "key-2" });
  });

  it("shows what each redemption recorded, falling back to the discount on older finance versions", () => {
    expect(redemptionAmount({ paidAmountSatang: 300_000, originalAmountSatang: 300_000 })).toEqual({ kind: "paid", satang: 300_000 });
    expect(redemptionAmount({ paidAmountSatang: 0, originalAmountSatang: 300_000 })).toEqual({ kind: "free", satang: 300_000 });
    expect(redemptionAmount({ originalAmountSatang: 300_000 })).toEqual({ kind: "discount", satang: 300_000 });
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
