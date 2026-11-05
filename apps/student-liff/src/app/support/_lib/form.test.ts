import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BODY_MAX,
  SUBJECT_MAX,
  buildCreateTicketPayload,
  buildNewRequestHref,
  createUuid,
  getSupportErrorKey,
  hasErrors,
  isTicketClosedError,
  isTicketNotFound,
  isUuid,
  isValidPaymentReference,
  nextReplyAttempt,
  parseSupportPrefill,
  resolveClassId,
  shouldKeepIdempotencyKey,
  validateSupportForm,
  type SupportFormValues,
} from "./form";

const CLASS_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

function values(overrides: Partial<SupportFormValues> = {}): SupportFormValues {
  return {
    category: "BOOK_DELIVERY",
    subject: "ยังไม่ได้รับหนังสือ",
    details: "สั่งไปตั้งแต่อาทิตย์ที่แล้ว ยังไม่ได้รับเลยค่ะ",
    classId: "",
    paymentReference: "",
    ...overrides,
  };
}

describe("validateSupportForm", () => {
  it("accepts a complete form", () => {
    const errors = validateSupportForm(values());
    expect(errors).toEqual({});
    expect(hasErrors(errors)).toBe(false);
  });

  it("flags every missing field", () => {
    expect(validateSupportForm(values({ category: "", subject: "  ", details: "" }))).toEqual({
      category: "support.categoryRequired",
      subject: "support.subjectRequired",
      details: "support.detailsRequired",
    });
  });

  it("rejects categories students cannot open", () => {
    expect(validateSupportForm(values({ category: "PAYOUT" })).category).toBe("support.categoryRequired");
  });

  it("checks lengths after trimming", () => {
    expect(validateSupportForm(values({ subject: "  ab  " })).subject).toBe("support.subjectTooShort");
    expect(validateSupportForm(values({ subject: "abc" })).subject).toBeUndefined();
    expect(validateSupportForm(values({ subject: "ก".repeat(SUBJECT_MAX + 1) })).subject).toBe("support.subjectTooLong");
    expect(validateSupportForm(values({ details: "  สั้นไป  " })).details).toBe("support.detailsTooShort");
    expect(validateSupportForm(values({ details: "x".repeat(BODY_MAX + 1) })).details).toBe("support.detailsTooLong");
    expect(validateSupportForm(values({ details: "x".repeat(BODY_MAX) })).details).toBeUndefined();
  });

  it("validates an optional payment reference", () => {
    expect(validateSupportForm(values({ paymentReference: "chrg_test_5x-Y" })).paymentReference).toBeUndefined();
    expect(validateSupportForm(values({ paymentReference: "chrg 123" })).paymentReference).toBe("support.refInvalid");
    expect(validateSupportForm(values({ paymentReference: "a".repeat(65) })).paymentReference).toBe("support.refInvalid");
  });
});

describe("buildCreateTicketPayload", () => {
  it("trims text and omits empty optional fields", () => {
    expect(
      buildCreateTicketPayload(values({ subject: "  หัวข้อ  ", details: "  รายละเอียดยาวพอ  " }), "key-1"),
    ).toEqual({ category: "BOOK_DELIVERY", subject: "หัวข้อ", body: "รายละเอียดยาวพอ", idempotencyKey: "key-1" });
  });

  it("includes class and payment reference when given", () => {
    expect(
      buildCreateTicketPayload(values({ category: "REFUND", classId: CLASS_ID, paymentReference: " chrg_1 " }), "key-2"),
    ).toMatchObject({ category: "REFUND", classId: CLASS_ID, paymentReference: "chrg_1", idempotencyKey: "key-2" });
  });
});

describe("prefill", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("keeps only well-formed values", () => {
    expect(parseSupportPrefill(params(`category=refund&classId=${CLASS_ID}&ref=chrg_test_1`))).toEqual({
      category: "REFUND",
      classId: CLASS_ID,
      paymentReference: "chrg_test_1",
    });
    expect(parseSupportPrefill(params("category=PAYOUT&classId=abc&ref=<script>"))).toEqual({
      category: "",
      classId: "",
      paymentReference: "",
    });
    expect(parseSupportPrefill(null)).toEqual({ category: "", classId: "", paymentReference: "" });
  });

  it("builds links to the form", () => {
    expect(buildNewRequestHref()).toBe("/support/new");
    expect(buildNewRequestHref({ category: "REFUND", ref: "chrg_test_1" })).toBe("/support/new?category=REFUND&ref=chrg_test_1");
    expect(buildNewRequestHref({ category: "REFUND", ref: "bad ref", classId: "nope" })).toBe("/support/new?category=REFUND");
  });

  it("sends only one of the student's own classes", () => {
    expect(resolveClassId(CLASS_ID, [CLASS_ID])).toBe(CLASS_ID);
    expect(resolveClassId(CLASS_ID, [])).toBe("");
    expect(resolveClassId("", [CLASS_ID])).toBe("");
  });
});

describe("ids", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates v4 UUIDs", () => {
    expect(isUuid(createUuid())).toBe(true);
    expect(createUuid()).not.toBe(createUuid());
  });

  it("falls back when crypto.randomUUID is missing", () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) });
    const id = createUuid();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("4");
  });

  it("validates payment references", () => {
    expect(isValidPaymentReference("pi_123-abc")).toBe(true);
    expect(isValidPaymentReference("")).toBe(false);
    expect(isValidPaymentReference("ไทย")).toBe(false);
  });
});

describe("nextReplyAttempt", () => {
  it("reuses the id for a retry of the same text and makes a new one otherwise", () => {
    let n = 0;
    const makeId = () => `id-${++n}`;
    const first = nextReplyAttempt(null, " ได้รับแล้ว ", makeId);
    expect(first).toEqual({ text: "ได้รับแล้ว", clientMessageId: "id-1" });
    expect(nextReplyAttempt(first, "ได้รับแล้ว", makeId)).toBe(first);
    expect(nextReplyAttempt(first, "ขอบคุณค่ะ", makeId)).toEqual({ text: "ขอบคุณค่ะ", clientMessageId: "id-2" });
  });
});

describe("getSupportErrorKey", () => {
  it("maps contract error codes to Thai copy keys", () => {
    expect(getSupportErrorKey({ status: 401, code: "UNAUTHORIZED" })).toBe("support.sessionExpired");
    expect(getSupportErrorKey({ status: 400, code: "INVALID_CATEGORY" })).toBe("support.invalidCategory");
    expect(getSupportErrorKey({ status: 400, code: "CLASS_NOT_ACCESSIBLE" })).toBe("support.classNotAccessible");
    expect(getSupportErrorKey({ status: 429, code: "TOO_MANY_OPEN_TICKETS" })).toBe("support.tooManyOpen");
    expect(getSupportErrorKey({ status: 429, code: "TICKET_RATE_LIMITED" })).toBe("support.rateLimited");
    expect(getSupportErrorKey({ status: 409, code: "TICKET_CLOSED" })).toBe("support.ticketClosed");
    expect(getSupportErrorKey({ status: 403, code: "FORBIDDEN" })).toBe("support.forbidden");
    expect(getSupportErrorKey({ status: 400, code: "VALIDATION_FAILED" })).toBe("support.invalidData");
    expect(getSupportErrorKey({ status: 500 })).toBe("support.sendFailed");
    expect(getSupportErrorKey(new TypeError("Failed to fetch"))).toBe("support.sendFailed");
    expect(getSupportErrorKey(null)).toBe("support.sendFailed");
  });

  it("keeps the idempotency key only when the request may have gone through", () => {
    expect(shouldKeepIdempotencyKey(new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldKeepIdempotencyKey({ status: 502 })).toBe(true);
    expect(shouldKeepIdempotencyKey({ status: 400, code: "VALIDATION_FAILED" })).toBe(false);
    expect(shouldKeepIdempotencyKey({ status: 429, code: "TICKET_RATE_LIMITED" })).toBe(false);
  });

  it("recognises not-found and closed tickets", () => {
    expect(isTicketNotFound({ status: 404, code: "TICKET_NOT_FOUND" })).toBe(true);
    expect(isTicketNotFound({ status: 500 })).toBe(false);
    expect(isTicketClosedError({ status: 409, code: "TICKET_CLOSED" })).toBe(true);
    expect(isTicketClosedError({ status: 400 })).toBe(false);
  });
});
