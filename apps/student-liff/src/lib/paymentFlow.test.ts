import { describe, expect, it } from "vitest";
import { t } from "./i18n";
import {
  buildEnrollmentFirstPath,
  buildEnrollPathFromInviteText,
  buildOmiseCardPayload,
  buildOrderSummaryFromClass,
  buildPaymentOrder,
  buildPaymentReturnUri,
  canSubmitAgeCheck,
  createDefaultOrderSummary,
  createUnknownOrderDisplay,
  formatCardExpiry,
  formatCardNumber,
  formatCountdown,
  getCardResultStatus,
  getChargeFailureKey,
  getDiscountCodeErrorKey,
  getDiscountPreviewErrorKey,
  getDiscountRowLabelKey,
  getDisplayAmountSatang,
  getPaymentBookLabel,
  getPaymentErrorKey,
  getPaymentMethodLabelKey,
  getPaymentStatusDisplay,
  getProceedStep,
  getQrCtaMode,
  getQrExpiresAt,
  getQrSecondsLeft,
  getReturnedPaymentStep,
  groupByMonth,
  hasAllCardFields,
  isDiscountCodeMethod,
  isDiscountCodeRejected,
  isDiscountQuoteFor,
  isEnrollmentFirstError,
  isFreeWithDiscount,
  isPaidOfflineQuote,
  isUnder18,
  isValidDateOfBirth,
  mergeCheckoutDetails,
  needsAgeCheck,
  needsGuardianConsent,
  normalizeDiscountCode,
  normalizePaymentMethod,
  parseClassIdFromQrText,
  parseInviteEnrollParams,
  PaymentFlowError,
  paymentStepForMethod,
  QR_LIFETIME_MS,
  sanitizeCardCvv,
  shouldLoadPromptPayQr,
  withQrCodeDataUri,
  type CheckoutDetails,
} from "./paymentFlow";

const pendingCheckout: CheckoutDetails = {
  provider: "omise",
  chargeId: "charge-1",
  status: "pending",
  paid: false,
  authorizeUri: null,
  qrCodeUrl: null,
  qrCodeDataUri: "data:image/png;base64,old",
  failureMessage: null,
};

describe("paymentFlow helpers", () => {
  it("validates dates of birth and distinguishes ages 17 and 18", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");

    expect(isUnder18("2008-07-02", now)).toBe(true);
    expect(isUnder18("2008-07-01", now)).toBe(false);
    expect(isValidDateOfBirth("2027-01-01", now)).toBe(false);
    expect(isValidDateOfBirth("2026-02-30", now)).toBe(false);
  });

  it("builds default and API-backed order summaries", () => {
    expect(createDefaultOrderSummary("class-1")).toMatchObject({
      id: "class-1",
      price: 3000,
      priceSatang: 300000,
    });

    expect(
      buildOrderSummaryFromClass(
        {
          id: "api-class",
          name: "Reading A1",
          book: "Reading",
          packagePriceSatang: 320000,
          tutor: { name: "Teacher Ada" },
        },
        "fallback",
      ),
    ).toEqual({
      id: "api-class",
      name: "Reading A1",
      price: 3200,
      priceSatang: 320000,
      tutor: "Teacher Ada",
      cefr: "Reading",
    });
  });

  it("preserves an existing QR data URI when checkout refresh omits it", () => {
    const next: CheckoutDetails = {
      ...pendingCheckout,
      status: "successful",
      paid: true,
      qrCodeDataUri: null,
    };

    expect(mergeCheckoutDetails(pendingCheckout, next)).toMatchObject({
      status: "successful",
      paid: true,
      qrCodeDataUri: "data:image/png;base64,old",
    });
    expect(mergeCheckoutDetails(pendingCheckout, null)).toBe(pendingCheckout);
  });

  it("derives returned payment behavior from intent status and method", () => {
    expect(getReturnedPaymentStep({ status: "SUCCESS" })).toBe("success");
    expect(getReturnedPaymentStep({ status: "SUCCESS", method: "card" })).toBe("success");
    // Unknown method keeps the old behaviour (PromptPay screen).
    expect(getReturnedPaymentStep({ status: "PENDING" })).toBe("qr");
    expect(getReturnedPaymentStep({ status: "PENDING", method: "promptpay" })).toBe("qr");
    // A card 3DS return that is not paid shows the card result, not the QR screen.
    expect(getReturnedPaymentStep({ status: "PENDING", method: "card" })).toBe("result");
    expect(getReturnedPaymentStep({ status: "FAILED", method: "CARD" })).toBe("result");
    expect(shouldLoadPromptPayQr({ status: "PENDING", method: "promptpay" })).toBe(true);
    expect(shouldLoadPromptPayQr({ status: "SUCCESS", method: "promptpay" })).toBe(false);
    expect(shouldLoadPromptPayQr({ status: "PENDING", method: "card" })).toBe(false);
    expect(getCardResultStatus("FAILED")).toBe("failed");
    expect(getCardResultStatus("PENDING")).toBe("pending");
    expect(getCardResultStatus(undefined)).toBe("pending");
  });

  it("normalizes payment methods from the API", () => {
    expect(normalizePaymentMethod("card")).toBe("card");
    expect(normalizePaymentMethod(" CARD ")).toBe("card");
    expect(normalizePaymentMethod("PROMPTPAY")).toBe("promptpay");
    expect(normalizePaymentMethod("bank")).toBeNull();
    expect(normalizePaymentMethod(null)).toBeNull();
  });

  it("formats card fields for Omise tokenization forms", () => {
    expect(formatCardNumber("4242abcd4242 4242 424299")).toBe("4242 4242 4242 4242");
    expect(formatCardExpiry("12345")).toBe("12/34");
    expect(formatCardExpiry("1a2b")).toBe("12/");
    expect(sanitizeCardCvv("1a2b345")).toBe("1234");
  });

  it("builds the Omise token payload exactly like the old page", () => {
    const card = { number: "4242 4242 4242 4242", name: "SOMCHAI JAIDEE", expiry: "12/29", cvv: "123" };
    expect(hasAllCardFields(card)).toBe(true);
    expect(hasAllCardFields({ ...card, cvv: "" })).toBe(false);
    expect(buildOmiseCardPayload(card)).toEqual({
      name: "SOMCHAI JAIDEE",
      number: "4242424242424242",
      expiration_month: 12,
      expiration_year: 2029,
      security_code: "123",
    });
    expect(buildOmiseCardPayload({ ...card, expiry: "01/2031" }).expiration_year).toBe(2031);
  });

  it("decides the step after the method screen", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");
    expect(paymentStepForMethod("promptpay")).toBe("qr");
    expect(paymentStepForMethod("card")).toBe("card-form");
    // Adults skip the age check.
    expect(getProceedStep("1990-01-01", false, "promptpay", now)).toBe("qr");
    expect(getProceedStep("1990-01-01", false, "card", now)).toBe("card-form");
    // Minors need consent; with consent they skip it too.
    expect(getProceedStep("2012-05-05", false, "card", now)).toBe("age-check");
    expect(getProceedStep("2012-05-05", true, "card", now)).toBe("card-form");
    // Unknown birthday → age check.
    expect(getProceedStep("", true, "promptpay", now)).toBe("age-check");
    // The same rule decides the age check of a ฿0 discount checkout.
    expect(needsAgeCheck("1990-01-01", false, now)).toBe(false);
    expect(needsAgeCheck("2012-05-05", false, now)).toBe(true);
    expect(needsAgeCheck("2012-05-05", true, now)).toBe(false);
    expect(needsAgeCheck("", true, now)).toBe(true);
  });

  it("requires guardian details only for minors without consent", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");
    expect(needsGuardianConsent("2012-05-05", false, now)).toBe(true);
    expect(needsGuardianConsent("2012-05-05", true, now)).toBe(false);
    expect(needsGuardianConsent("1990-01-01", false, now)).toBe(false);

    const minor = { dateOfBirth: "2012-05-05", guardianName: "", guardianRelation: "", consentAlreadyGiven: false };
    expect(canSubmitAgeCheck(minor, now)).toBe(false);
    expect(canSubmitAgeCheck({ ...minor, guardianName: "Somchai", guardianRelation: " " }, now)).toBe(false);
    expect(canSubmitAgeCheck({ ...minor, guardianName: "Somchai", guardianRelation: "พ่อ" }, now)).toBe(true);
    expect(canSubmitAgeCheck({ ...minor, consentAlreadyGiven: true }, now)).toBe(true);
    expect(canSubmitAgeCheck({ ...minor, dateOfBirth: "1990-01-01" }, now)).toBe(true);
    expect(canSubmitAgeCheck({ ...minor, dateOfBirth: "2030-01-01" }, now)).toBe(false);
  });

  it("builds the order and a display that never shows the fallback price", () => {
    const cls = {
      id: "c1",
      name: "Reading A1",
      book: "Primary 1",
      cefr: "A1",
      packagePriceSatang: 320000,
      tutor: { name: "Teacher Ada" },
      bookCycles: [{ id: "cy1", title: "Book 2", price: 1800, packagePriceSatang: 180000, cefr: "A2" }],
    };

    expect(buildPaymentOrder(cls, "c1", "")).toEqual({
      order: { id: "c1", name: "Reading A1", price: 3200, priceSatang: 320000, tutor: "Teacher Ada", cefr: "Primary 1" },
      display: { name: "Reading A1", tutor: "Teacher Ada", cefr: "Primary 1", priceSatang: 320000 },
    });

    // Book-cycle purchase: name "class / cycle", cycle price and CEFR.
    expect(buildPaymentOrder(cls, "c1", "cy1")).toEqual({
      order: { id: "c1", name: "Reading A1 / Book 2", price: 1800, priceSatang: 180000, tutor: "Teacher Ada", cefr: "A2" },
      display: { name: "Reading A1 / Book 2", tutor: "Teacher Ada", cefr: "A2", priceSatang: 180000 },
    });

    // Unknown cycle id → class order.
    expect(buildPaymentOrder(cls, "c1", "missing").order.priceSatang).toBe(320000);

    // No price from the API: the payload keeps the old fallback, the screen shows none.
    const noPrice = buildPaymentOrder({ ...cls, packagePriceSatang: null }, "c1", "");
    expect(noPrice.order.priceSatang).toBe(300000);
    expect(noPrice.display.priceSatang).toBeNull();
    expect(createUnknownOrderDisplay().priceSatang).toBeNull();
  });

  it("shows the intent amount once an intent exists", () => {
    expect(getDisplayAmountSatang(330000, 320000)).toBe(330000);
    expect(getDisplayAmountSatang(null, 320000)).toBe(320000);
    expect(getDisplayAmountSatang(undefined, null)).toBeNull();
    expect(getDisplayAmountSatang(0, 0)).toBeNull();
  });

  it("shows ฿0 for an applied code instead of falling back to the full price", () => {
    const free = { finalAmountSatang: 0 };
    expect(getDisplayAmountSatang(null, 320000, free)).toBe(0);
    // The redeemed intent is 0 THB: still ฿0, not the class price.
    expect(getDisplayAmountSatang(0, 320000, free)).toBe(0);
    // A paid intent made before the code was applied keeps its own amount.
    expect(getDisplayAmountSatang(320000, 320000, free)).toBe(320000);
    // No code: unknown prices stay unknown.
    expect(getDisplayAmountSatang(0, null, null)).toBeNull();
  });

  it("normalizes discount codes and ties a quote to its class and book cycle", () => {
    expect(normalizeDiscountCode("  dc-ab cd-2345\t")).toBe("DC-ABCD-2345");
    expect(normalizeDiscountCode("   ")).toBe("");

    const quote = { classId: "C1-UUID", cycleId: null };
    expect(isDiscountQuoteFor(quote, "c1-uuid", "")).toBe(true);
    expect(isDiscountQuoteFor(quote, "c2-uuid", "")).toBe(false);
    expect(isDiscountQuoteFor(quote, "c1-uuid", "cy1")).toBe(false);
    expect(isDiscountQuoteFor({ classId: "c1", cycleId: "cy1" }, "c1", "cy1")).toBe(true);

    expect(isFreeWithDiscount({ finalAmountSatang: 0 })).toBe(true);
    expect(isFreeWithDiscount({ finalAmountSatang: 100 })).toBe(false);
    expect(isFreeWithDiscount(null)).toBe(false);
  });

  it("labels a code that records a payment made outside the app ชำระแล้วนอกระบบ, not ส่วนลด", () => {
    expect(isPaidOfflineQuote({ offlinePaidSatang: 320000 })).toBe(true);
    expect(getDiscountRowLabelKey({ offlinePaidSatang: 320000 })).toBe("payment.select.paidOffline");
    expect(t("payment.select.paidOffline")).toBe("ชำระแล้วนอกระบบ");
    // A free code (0/null) and an older finance version (no field) stay a discount.
    for (const quote of [{ offlinePaidSatang: 0 }, { offlinePaidSatang: null }, {}, null]) {
      expect(isPaidOfflineQuote(quote), JSON.stringify(quote)).toBe(false);
      expect(getDiscountRowLabelKey(quote), JSON.stringify(quote)).toBe("payment.select.discount");
    }
    expect(t("payment.select.discount")).toBe("ส่วนลด");
  });

  it("shows the amount recorded on a redeemed code's payment on the receipt", () => {
    const quote = { finalAmountSatang: 0 };
    // Paid outside the app: the intent carries that amount.
    expect(getDisplayAmountSatang(320000, 320000, quote)).toBe(320000);
    expect(getDisplayAmountSatang(250000, 320000, quote)).toBe(250000);
    // A free code's intent is ฿0.
    expect(getDisplayAmountSatang(0, 320000, quote)).toBe(0);
  });

  it("maps discount code errors to the code field in Thai", () => {
    const err = (code: string, status = 409) => Object.assign(new Error("x"), { code, status });
    expect(getDiscountCodeErrorKey(err("DISCOUNT_CODE_NOT_FOUND", 404))).toBe("payment.discount.errors.notFound");
    expect(getDiscountCodeErrorKey(err("DISCOUNT_CODE_WRONG_CLASS"))).toBe("payment.discount.errors.wrongClass");
    expect(getDiscountCodeErrorKey(err("PAYMENT_IN_PROGRESS"))).toBe("payment.errors.paymentInProgress");
    expect(getDiscountCodeErrorKey(err("PAYMENT_ALREADY_COMPLETED"))).toBe("payment.errors.alreadyPaid");
    // The rate limiter answers 429 without an error code.
    expect(getDiscountCodeErrorKey({ status: 429 })).toBe("payment.discount.errors.tooManyAttempts");
    // Not about the code: the checkout toast handles it.
    expect(getDiscountCodeErrorKey(err("CLASS_FULL"))).toBeNull();
    expect(getDiscountCodeErrorKey(err("toString"))).toBeNull();
    expect(getDiscountCodeErrorKey(null)).toBeNull();

    expect(getDiscountPreviewErrorKey(err("DISCOUNT_CODE_EXPIRED"))).toBe("payment.discount.errors.expired");
    expect(getDiscountPreviewErrorKey(new TypeError("Failed to fetch"))).toBe("common.networkError");
    expect(getDiscountPreviewErrorKey(err("INVALID_REQUEST", 400))).toBe("payment.discount.errors.checkFailed");

    expect(isDiscountCodeRejected(err("DISCOUNT_CODE_USED_UP"))).toBe(true);
    expect(isDiscountCodeRejected(err("PAYMENT_IN_PROGRESS"))).toBe(false);
    expect(isDiscountCodeRejected({ status: 429 })).toBe(false);

    expect(t("payment.discount.errors.notFound")).toBe("ไม่พบโค้ดนี้ ตรวจสอบตัวอักษรอีกครั้ง");
    expect(t("payment.discount.errors.expired")).toBe("โค้ดนี้หมดอายุแล้ว");
    expect(t("payment.discount.errors.usedUp")).toBe("โค้ดนี้ถูกใช้ครบจำนวนแล้ว");
    expect(t("payment.discount.errors.alreadyUsed")).toBe("คุณใช้โค้ดนี้ไปแล้ว");
    expect(t("payment.discount.errors.void")).toBe("โค้ดนี้ถูกยกเลิกแล้ว");
    expect(t("payment.discount.errors.wrongClass")).toBe("โค้ดนี้ใช้กับคลาสอื่น");
    expect(t("payment.discount.errors.tooManyAttempts")).toBe("ลองหลายครั้งเกินไป กรุณารอสักครู่");
  });

  it("computes the QR deadline and countdown from timestamps", () => {
    const loadedAt = Date.UTC(2026, 9, 2, 8, 0, 0);
    const expiresAt = getQrExpiresAt(loadedAt);
    expect(expiresAt - loadedAt).toBe(QR_LIFETIME_MS);
    expect(getQrSecondsLeft(expiresAt, loadedAt)).toBe(900);
    expect(getQrSecondsLeft(expiresAt, loadedAt + 1)).toBe(900);
    expect(getQrSecondsLeft(expiresAt, expiresAt - 1_500)).toBe(2);
    expect(getQrSecondsLeft(expiresAt, expiresAt + 10_000)).toBe(0);
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(-3)).toBe("00:00");
  });

  it("adds the QR image to the checkout or builds the minimal pending checkout", () => {
    expect(withQrCodeDataUri(pendingCheckout, { chargeId: "x", dataUri: "data:new" })).toEqual({
      ...pendingCheckout,
      qrCodeDataUri: "data:new",
    });
    expect(withQrCodeDataUri(null, { chargeId: "charge-9", dataUri: "data:qr" })).toEqual({
      provider: "omise",
      chargeId: "charge-9",
      status: "pending",
      paid: false,
      authorizeUri: null,
      qrCodeUrl: null,
      qrCodeDataUri: "data:qr",
      failureMessage: null,
    });
  });

  it("picks the PromptPay button mode", () => {
    const base = { hasIntent: true, busy: false, qrLoading: false, expired: false, failed: false };
    expect(getQrCtaMode({ ...base, hasIntent: false })).toBe("create");
    expect(getQrCtaMode({ ...base, hasIntent: false, busy: true })).toBe("creating");
    expect(getQrCtaMode({ ...base, qrLoading: true })).toBe("creating");
    expect(getQrCtaMode(base)).toBe("verify");
    expect(getQrCtaMode({ ...base, busy: true })).toBe("verifying");
    expect(getQrCtaMode({ ...base, expired: true })).toBe("regenerate");
    expect(getQrCtaMode({ ...base, failed: true })).toBe("regenerate");
  });

  it("builds the 3DS return URI and the enrollment-first path", () => {
    expect(
      buildPaymentReturnUri("https://app.test/payment?classId=old&x=1", {
        classId: "c1",
        cycleId: "cy1",
        referralToken: "ref 1",
      }),
    ).toBe("https://app.test/payment?classId=c1&cycleId=cy1&referralToken=ref+1");
    expect(buildPaymentReturnUri("https://app.test/payment", { classId: "", cycleId: "", referralToken: "r" })).toBe(
      "https://app.test/payment?referralToken=r",
    );
    expect(buildEnrollmentFirstPath("c1", null)).toBe("/payment?classId=c1");
    expect(buildEnrollmentFirstPath("c1", "tok")).toBe("/payment?classId=c1&referralToken=tok");
  });

  it("detects the enrollment-first API errors by code or legacy message", () => {
    expect(isEnrollmentFirstError({ code: "NOT_ENROLLED", message: "x" })).toBe(true);
    expect(isEnrollmentFirstError({ code: "ENROLLMENT_PAYMENT_PENDING" })).toBe(true);
    expect(isEnrollmentFirstError(new Error("Please enroll in the class first"))).toBe(true);
    expect(isEnrollmentFirstError(new Error("Please complete your class enrollment payment first"))).toBe(true);
    expect(isEnrollmentFirstError(new Error("Class is full"))).toBe(false);
    expect(isEnrollmentFirstError(null)).toBe(false);
  });

  it("maps checkout errors to friendly Thai messages (never raw API text)", () => {
    expect(getPaymentErrorKey(new PaymentFlowError("gateway"), "card")).toBe("payment.errors.omiseNotConfigured");
    expect(getPaymentErrorKey(new PaymentFlowError("card-script"), "card")).toBe("payment.errors.loadOmiseScript");
    expect(getPaymentErrorKey(new PaymentFlowError("card-token", "invalid card"), "card")).toBe(
      "payment.errors.createCardTokenFailed",
    );
    expect(getPaymentErrorKey(new PaymentFlowError("failed", "insufficient funds in the account"), "card")).toBe(
      "payment.errors.insufficientFunds",
    );
    expect(getPaymentErrorKey(new PaymentFlowError("failed", "payment rejected"), "card")).toBe(
      "payment.errors.cardDeclined",
    );
    expect(getPaymentErrorKey(new PaymentFlowError("incomplete"), "card")).toBe("payment.errors.cardFailed");
    expect(getPaymentErrorKey(new PaymentFlowError("failed"), "promptpay")).toBe("payment.errors.qrFailed");
    expect(getPaymentErrorKey({ code: "PAYMENT_IN_PROGRESS" }, "promptpay")).toBe("payment.errors.paymentInProgress");
    expect(getPaymentErrorKey({ code: "PAYMENT_ALREADY_COMPLETED" }, "promptpay")).toBe("payment.errors.alreadyPaid");
    expect(getPaymentErrorKey({ code: "CLASS_FULL" }, "promptpay")).toBe("payment.errors.classFull");
    expect(getPaymentErrorKey({ code: "REFERRAL_INVALID" }, "promptpay")).toBe("payment.errors.referralInvalid");
    expect(getPaymentErrorKey(new TypeError("Failed to fetch"), "promptpay")).toBe("common.networkError");
    expect(getPaymentErrorKey(new Error("Internal"), "promptpay")).toBe("payment.errors.enrollmentFailed");
    expect(getChargeFailureKey(null, "card")).toBe("payment.errors.cardFailed");
    expect(getChargeFailureKey("Insufficient Fund", "card")).toBe("payment.errors.insufficientFunds");
  });

  it("describes payment history rows", () => {
    expect(getPaymentStatusDisplay("success")).toEqual({ tone: "success", labelKey: "payment.history.statusSuccess" });
    expect(getPaymentStatusDisplay("PENDING").tone).toBe("warning");
    expect(getPaymentStatusDisplay("FAILED").tone).toBe("danger");
    expect(getPaymentStatusDisplay("REFUNDED").labelKey).toBe("payment.history.statusRefunded");
    expect(getPaymentStatusDisplay(undefined).labelKey).toBe("payment.history.statusOther");
    expect(getPaymentMethodLabelKey("PROMPTPAY")).toBe("payment.methods.promptpay");
    expect(getPaymentMethodLabelKey("card")).toBe("payment.methods.card");
    expect(getPaymentMethodLabelKey("anything")).toBe("payment.methods.card");
    expect(getPaymentMethodLabelKey("DISCOUNT_CODE")).toBe("payment.methods.discountCode");
    expect(t(getPaymentMethodLabelKey("DISCOUNT_CODE"))).toBe("โค้ดส่วนลด");
    expect(isDiscountCodeMethod(" discount_code ")).toBe(true);
    expect(isDiscountCodeMethod("promptpay")).toBe(false);
    expect(isDiscountCodeMethod(null)).toBe(false);

    const enrollment = {
      enrollmentId: "e1",
      status: "ACTIVE",
      class: { title: "Reading A1", book: { title: "Origins", bookCode: "PO-1" } },
    };
    expect(getPaymentBookLabel({ enrollment })).toBe("PO-1: Origins");
    expect(getPaymentBookLabel({ enrollment: { ...enrollment, class: { ...enrollment.class, book: { title: "Origins", bookCode: "" } } } })).toBe(
      "Origins",
    );
    expect(getPaymentBookLabel({ enrollment: null })).toBeNull();
  });

  it("groups history by local month, keeping the API order", () => {
    const items = [
      { id: "a", createdAt: new Date(2026, 9, 2, 10).toISOString() },
      { id: "b", createdAt: new Date(2026, 9, 1, 8).toISOString() },
      { id: "c", createdAt: new Date(2026, 8, 30, 23).toISOString() },
      { id: "d", createdAt: "not a date" },
    ];
    const groups = groupByMonth(items);
    expect(groups.map((group) => group.key)).toEqual(["2026-10", "2026-09", "unknown"]);
    expect(groups[0].items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(groups[0].label).toContain("ตุลาคม");
    expect(groups[2].label).toBe("");
  });

  it("extracts class IDs from scanned QR text", () => {
    expect(parseClassIdFromQrText("https://app.example.com/enroll?classId=class-1")).toBe("class-1");
    expect(parseClassIdFromQrText("/enroll?token=abc&classId=class%202")).toBe("class 2");
    expect(parseClassIdFromQrText("not a class QR")).toBeNull();
  });

  it("builds enroll paths from invite links without dropping referral tokens", () => {
    expect(parseInviteEnrollParams("https://app.example.com/enroll?classId=class-1&referralToken=ref-1")).toEqual({
      classId: "class-1",
      referralToken: "ref-1",
    });
    expect(buildEnrollPathFromInviteText("/enroll?token=abc&classId=class%202")).toBe(
      "/enroll?classId=class+2&referralToken=abc",
    );
    expect(buildEnrollPathFromInviteText("not a class QR")).toBeNull();
  });
});
