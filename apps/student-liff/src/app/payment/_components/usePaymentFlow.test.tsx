// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getClassDetails: vi.fn(),
  getCurrentUser: vi.fn(),
  checkGuardianConsent: vi.fn(),
  updateProfile: vi.fn(),
  submitGuardianConsent: vi.fn(),
  prepareClassBookCycleAccess: vi.fn(),
  enrollByReferral: vi.fn(),
  enrollClass: vi.fn(),
  getPaymentConfig: vi.fn(),
  getPaymentStatus: vi.fn(),
  getPaymentQrCode: vi.fn(),
  createPaymentIntent: vi.fn(),
  previewDiscountCode: vi.fn(),
  redeemDiscountCode: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), success: vi.fn() }));
const invalidateResource = vi.hoisted(() => vi.fn());
const omise = vi.hoisted(() => ({
  loadOmiseScript: vi.fn(),
  createOmiseCardToken: vi.fn(),
  redirectToAuthorizeUri: vi.fn(),
}));

vi.mock("../../../lib/api", () => ({ studentApi: api }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast }));
vi.mock("../../../lib/cachedResource", () => ({ invalidateResource }));
vi.mock("../../../components/providers/LiffProvider", () => ({
  useLiff: () => ({ profile: { userId: "u1" } }),
}));
vi.mock("./omise", () => omise);

import { usePaymentFlow, type PaymentFlow, type PaymentFlowParams } from "./usePaymentFlow";
import { t } from "../../../lib/i18n";
import { QR_LIFETIME_MS } from "../../../lib/paymentFlow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let flow: PaymentFlow;
function Probe(props: PaymentFlowParams) {
  flow = usePaymentFlow(props);
  return null;
}

const CLASS = {
  class: {
    id: "c1",
    name: "Reading A1",
    book: "Primary 1",
    packagePriceSatang: 320000,
    tutor: { name: "Teacher Ada" },
    bookCycles: [{ id: "cy1", title: "Book 2", price: 1800, packagePriceSatang: 180000, cefr: "A2" }],
  },
};
const ADULT = { user: { dateOfBirth: "1990-01-01" } };
const MINOR = { user: { dateOfBirth: "2014-03-03" } };
const PENDING_ENROLLMENT = { status: "PENDING", enrollmentId: "e1", enrollmentPackageId: "p1", amountSatang: 320000 };
const QUOTE = {
  code: "DC-ABCD-2345",
  discountCodeId: "dc1",
  classId: "c1",
  cycleId: null,
  originalAmountSatang: 320000,
  discountSatang: 320000,
  finalAmountSatang: 0,
};
const REDEEMED = {
  intent: { paymentIntentId: "pi-dc", status: "SUCCESS", method: "DISCOUNT_CODE", amountMinor: 0 },
  checkout: null,
  discount: QUOTE,
};

function apiError(status: number, code?: string) {
  return Object.assign(new Error(code ?? `API Error ${status}`), { status, code });
}

function intentResponse(overrides: Record<string, unknown> = {}, checkout: Record<string, unknown> | null = {}) {
  return {
    intent: { paymentIntentId: "pi1", status: "PENDING", method: "promptpay", amountMinor: 320000, ...overrides },
    checkout:
      checkout === null
        ? null
        : {
            provider: "omise",
            chargeId: "ch1",
            status: "pending",
            paid: false,
            authorizeUri: null,
            qrCodeUrl: null,
            qrCodeDataUri: null,
            failureMessage: null,
            ...checkout,
          },
  };
}

const params = (overrides: Partial<PaymentFlowParams> = {}): PaymentFlowParams => ({
  classId: "c1",
  cycleId: "",
  referralToken: null,
  returnedPaymentIntentId: null,
  ...overrides,
});

describe("usePaymentFlow", () => {
  let container: HTMLDivElement;
  let root: Root;

  /** Lets resolved mocks and their promise chains settle (real timers). */
  const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const render = async (props: PaymentFlowParams = params(), acceptPolicy = true) => {
    await act(async () => root.render(<Probe {...props} />));
    await settle();
    if (acceptPolicy) await act(async () => flow.actions.acceptPolicy(true));
  };

  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    router.replace.mockReset();
    toast.error.mockReset();
    toast.info.mockReset();
    invalidateResource.mockReset();
    omise.loadOmiseScript.mockReset().mockResolvedValue(undefined);
    omise.createOmiseCardToken.mockReset().mockResolvedValue("tokn_1");
    omise.redirectToAuthorizeUri.mockReset();

    api.getClassDetails.mockResolvedValue(CLASS);
    api.getCurrentUser.mockResolvedValue(ADULT);
    api.checkGuardianConsent.mockResolvedValue({ hasConsent: false });
    api.enrollClass.mockResolvedValue(PENDING_ENROLLMENT);
    api.createPaymentIntent.mockResolvedValue(intentResponse());
    api.getPaymentQrCode.mockResolvedValue({ chargeId: "ch1", dataUri: "data:image/png;base64,QR" });
    api.getPaymentStatus.mockResolvedValue(intentResponse());
    api.getPaymentConfig.mockResolvedValue({ configured: true, publicKey: "pkey_test" });
    api.previewDiscountCode.mockResolvedValue({ discount: QUOTE });
    api.redeemDiscountCode.mockResolvedValue(REDEEMED);

    window.history.replaceState(null, "", "/payment?classId=c1&extra=1");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("requires policy acceptance before any new enrollment, token or charge", async () => {
    await render(params(), false);
    expect(flow.policyAccepted).toBe(false);
    await act(async () => flow.actions.proceed());
    await act(async () => flow.actions.confirmPayment());
    await act(async () => flow.actions.selectMethod("card"));
    await act(async () => flow.actions.proceed());
    await act(async () => flow.actions.confirmPayment());
    expect(flow.step).toBe("select");
    expect(api.enrollClass).not.toHaveBeenCalled();
    expect(api.createPaymentIntent).not.toHaveBeenCalled();
    expect(omise.createOmiseCardToken).not.toHaveBeenCalled();
    await act(async () => flow.actions.acceptPolicy(true));
    await act(async () => flow.actions.acceptPolicy(false));
    await act(async () => flow.actions.submitAgeCheck());
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it("resumes an existing QR without accepting again, but blocks a new QR", async () => {
    await render(params({ returnedPaymentIntentId: "pi1" }), false);
    expect(flow.step).toBe("qr");
    await act(async () => flow.actions.confirmPayment());
    expect(api.getPaymentStatus).toHaveBeenCalledWith("pi1");
    expect(api.createPaymentIntent).not.toHaveBeenCalled();
    await act(async () => flow.actions.regenerateQr());
    expect(flow.step).toBe("select");
    expect(api.enrollClass).not.toHaveBeenCalled();
    expect(api.createPaymentIntent).not.toHaveBeenCalled();
  });

  it("resumes a card result without acknowledgement and requires it before retry", async () => {
    api.getPaymentStatus.mockResolvedValue(intentResponse({ method: "card", status: "FAILED" }));
    await render(params({ returnedPaymentIntentId: "pi1" }), false);
    expect(flow.step).toBe("result");
    await act(async () => flow.actions.checkCardResult());
    await act(async () => flow.actions.retryCard());
    expect(flow.step).toBe("select");
    expect(api.createPaymentIntent).not.toHaveBeenCalled();
  });

  it("loads the class and saved birthday before allowing proceed", async () => {
    let resolveUser!: (value: unknown) => void;
    api.getCurrentUser.mockReturnValue(new Promise((resolve) => (resolveUser = resolve)));
    await render();

    expect(api.getClassDetails).toHaveBeenCalledWith("c1");
    expect(flow.classStatus).toBe("ready");
    expect(flow.display).toMatchObject({ name: "Reading A1", priceSatang: 320000 });
    expect(flow.amountSatang).toBe(320000);
    // Birthday still loading → proceed waits (adults are not sent to the age check).
    expect(flow.profileLoading).toBe(true);
    expect(flow.canProceed).toBe(false);

    await act(async () => resolveUser(ADULT));
    await settle();
    expect(flow.canProceed).toBe(true);
  });

  it("shows an error (no fallback price) when the class fails, and retries", async () => {
    api.getClassDetails.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render();

    expect(flow.classStatus).toBe("error");
    expect(flow.canProceed).toBe(false);
    expect(flow.amountSatang).toBeNull();

    await act(async () => flow.retryClass());
    await settle();
    expect(api.getClassDetails).toHaveBeenCalledTimes(2);
    expect(flow.classStatus).toBe("ready");
  });

  it("PromptPay: proceed creates the intent with the same payload and shows the QR", async () => {
    await render();
    await act(async () => flow.actions.proceed());
    await settle();

    expect(api.enrollClass).toHaveBeenCalledWith("c1", null);
    expect(api.createPaymentIntent).toHaveBeenCalledWith({
      enrollmentId: "e1",
      enrollmentPackageId: "p1",
      amountSatang: 320000,
      method: "promptpay",
      omiseToken: undefined,
      returnUri: "http://localhost:3000/payment?classId=c1",
    });
    expect(api.getPaymentQrCode).toHaveBeenCalledWith("pi1");
    expect(flow.step).toBe("qr");
    expect(flow.paymentIntentId).toBe("pi1");
    expect(flow.qr.dataUri).toBe("data:image/png;base64,QR");
    expect(flow.qr.ctaMode).toBe("verify");
    expect(flow.qr.polling).toBe(true);
    expect(flow.qr.expiresAt).not.toBeNull();
    // The step has its own history entry (hardware back returns to the method screen).
    expect(window.history.state).toMatchObject({ __taPaymentStep: "qr" });
  });

  it("minor without consent: age check saves birthday + guardian consent, then the card form", async () => {
    api.getCurrentUser.mockResolvedValue(MINOR);
    api.updateProfile.mockResolvedValue({ user: { requiresGuardian: true } });
    api.submitGuardianConsent.mockResolvedValue({});
    await render();

    await act(async () => flow.actions.selectMethod("card"));
    await act(async () => flow.actions.proceed());
    expect(flow.step).toBe("age-check");
    expect(flow.ageCheck.needsGuardian).toBe(true);
    expect(flow.ageCheck.canSubmit).toBe(false);

    await act(async () => {
      flow.ageCheck.setGuardianName("Somchai");
      flow.ageCheck.setGuardianRelation("พ่อ");
    });
    expect(flow.ageCheck.canSubmit).toBe(true);
    await act(async () => flow.actions.submitAgeCheck());
    await settle();

    expect(api.updateProfile).toHaveBeenCalledWith("2014-03-03");
    expect(api.submitGuardianConsent).toHaveBeenCalledWith("Somchai", "พ่อ");
    expect(flow.step).toBe("card-form");
    expect(api.createPaymentIntent).not.toHaveBeenCalled();
  });

  it("hardware back from a step returns to the method screen and keeps the QR check running", async () => {
    await render();
    await act(async () => flow.actions.proceed());
    await settle();
    expect(flow.step).toBe("qr");

    await act(async () => {
      // jsdom fires popstate in a later task; wait for the event itself (a fixed
      // 20ms sleep was flaky when the whole suite runs in parallel).
      const popped = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
      window.history.back();
      await popped;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(flow.step).toBe("select");
    expect(flow.qr.polling).toBe(true);
  });

  it("card: tokenizes, redirects to 3DS once and keeps the button busy", async () => {
    api.createPaymentIntent.mockResolvedValue(
      intentResponse({ method: "card" }, { authorizeUri: "https://bank.test/3ds" }),
    );
    await render();
    await act(async () => flow.actions.selectMethod("card"));
    await act(async () => flow.actions.proceed());
    await settle(); // card form prefetches the gateway config + omise.js
    expect(api.getPaymentConfig).toHaveBeenCalledTimes(1);
    expect(omise.loadOmiseScript).toHaveBeenCalled();

    await act(async () => {
      flow.card.setNumber("4242424242424242");
      flow.card.setName("somchai jaidee");
      flow.card.setExpiry("1229");
      flow.card.setCvv("123");
    });
    expect(flow.card.number).toBe("4242 4242 4242 4242");
    expect(flow.card.name).toBe("SOMCHAI JAIDEE");

    await act(async () => {
      void flow.actions.confirmPayment();
      void flow.actions.confirmPayment(); // double tap
    });
    await settle();

    expect(omise.createOmiseCardToken).toHaveBeenCalledWith("pkey_test", {
      number: "4242 4242 4242 4242",
      name: "SOMCHAI JAIDEE",
      expiry: "12/29",
      cvv: "123",
    });
    expect(api.getPaymentConfig).toHaveBeenCalledTimes(1); // prefetched config reused
    expect(api.createPaymentIntent).toHaveBeenCalledTimes(1);
    expect(api.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ method: "card", omiseToken: "tokn_1", amountSatang: 320000 }),
    );
    expect(omise.redirectToAuthorizeUri).toHaveBeenCalledWith("https://bank.test/3ds");
    expect(flow.redirectUri).toBe("https://bank.test/3ds");
    expect(flow.loading).toBe(true);

    await act(async () => void flow.actions.confirmPayment());
    await settle();
    expect(api.createPaymentIntent).toHaveBeenCalledTimes(1);

    // Back from the bank page restored from bfcache: not stuck on the redirect screen.
    await act(async () => {
      const event = new Event("pageshow");
      Object.defineProperty(event, "persisted", { value: true });
      window.dispatchEvent(event);
    });
    expect(flow.redirectUri).toBeNull();
    expect(flow.loading).toBe(false);
    expect(flow.step).toBe("card-form");
  });

  it("returned card intent that is pending shows the card result (method restored)", async () => {
    api.getPaymentStatus.mockResolvedValue(intentResponse({ method: "card", status: "PENDING" }));
    await render(params({ returnedPaymentIntentId: "pi1" }));

    expect(api.getPaymentStatus).toHaveBeenCalledWith("pi1");
    expect(flow.resuming).toBe(false);
    expect(flow.step).toBe("result");
    expect(flow.method).toBe("card");
    expect(flow.cardResult).toBe("pending");
    expect(api.getPaymentQrCode).not.toHaveBeenCalled();

    api.getPaymentStatus.mockResolvedValue(intentResponse({ method: "card", status: "FAILED" }));
    await act(async () => void flow.actions.checkCardResult());
    await settle();
    expect(flow.cardResult).toBe("failed");

    await act(async () => flow.actions.retryCard());
    expect(flow.step).toBe("card-form");
    expect(flow.paymentIntentId).toBeNull();
  });

  it("returned PromptPay intent reloads the QR; returned success shows the receipt and refreshes caches", async () => {
    await render(params({ returnedPaymentIntentId: "pi1" }));
    expect(flow.step).toBe("qr");
    expect(flow.method).toBe("promptpay");
    expect(api.getPaymentQrCode).toHaveBeenCalledWith("pi1");
    act(() => root.unmount());

    root = createRoot(container);
    api.getPaymentStatus.mockResolvedValue(intentResponse({ status: "SUCCESS", method: "card", amountMinor: 330000 }));
    await render(params({ returnedPaymentIntentId: "pi2" }));
    expect(flow.step).toBe("success");
    expect(flow.method).toBe("card");
    expect(flow.amountSatang).toBe(330000);
    expect(invalidateResource).toHaveBeenCalledWith("u1:");
  });

  it("already-active enrollment goes straight to success", async () => {
    api.enrollClass.mockResolvedValue({ status: "ACTIVE" });
    await render();
    await act(async () => flow.actions.proceed());
    await settle();
    expect(flow.step).toBe("success");
    expect(api.createPaymentIntent).not.toHaveBeenCalled();
    expect(invalidateResource).toHaveBeenCalledWith("u1:");
  });

  it("book cycle needing the class enrollment first goes to the class checkout", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.prepareClassBookCycleAccess.mockRejectedValue(Object.assign(new Error("x"), { code: "NOT_ENROLLED" }));
    await render(params({ cycleId: "cy1", referralToken: "tok" }));
    expect(flow.display.name).toBe("Reading A1 / Book 2");

    await act(async () => flow.actions.proceed());
    await settle();
    expect(api.prepareClassBookCycleAccess).toHaveBeenCalledWith("c1", "cy1");
    expect(api.enrollByReferral).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/payment?classId=c1&referralToken=tok");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("referral checkout enrolls by token and keeps the old amount fallback in the payload", async () => {
    api.enrollByReferral.mockResolvedValue({ ...PENDING_ENROLLMENT, amountSatang: 0 });
    await render(params({ classId: "", referralToken: "tok" }));
    expect(api.getClassDetails).not.toHaveBeenCalled();
    expect(flow.display.priceSatang).toBeNull();

    await act(async () => flow.actions.proceed());
    await settle();
    expect(api.enrollByReferral).toHaveBeenCalledWith("tok");
    expect(api.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amountSatang: 300000, returnUri: "http://localhost:3000/payment?referralToken=tok" }),
    );
    // Once the intent exists its own amount is shown.
    expect(flow.amountSatang).toBe(320000);
  });

  it("maps API errors to friendly toasts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.enrollClass.mockRejectedValue(Object.assign(new Error("Another payment"), { code: "PAYMENT_IN_PROGRESS" }));
    await render();
    await act(async () => flow.actions.proceed());
    await settle();
    expect(toast.error).toHaveBeenCalledWith("มีรายการจ่ายเงินอื่นค้างอยู่ รอสักครู่แล้วลองใหม่ หรือติดต่อทีมงานนะ");
    expect(flow.qr.ctaMode).toBe("create");
    expect(flow.loading).toBe(false);
  });

  describe("discount code", () => {
    const applyCode = async (code = "DC-ABCD-2345") => {
      await act(async () => flow.discount.setCode(code));
      await act(async () => flow.actions.applyDiscountCode());
      await settle();
    };

    it("apply → ฿0 → enroll first, then redeem → success with the class to enter", async () => {
      api.enrollClass.mockResolvedValue({ ...PENDING_ENROLLMENT, classId: "c1" });
      await render();
      expect(flow.discount.available).toBe(true);

      await applyCode(" dc-abcd -2345 ");
      expect(api.previewDiscountCode).toHaveBeenCalledWith({ code: "DC-ABCD-2345", classId: "c1", cycleId: undefined });
      expect(flow.discount.quote).toEqual(QUOTE);
      expect(flow.discount.code).toBe("DC-ABCD-2345");
      expect(flow.discount.free).toBe(true);
      expect(flow.amountSatang).toBe(0);
      expect(api.enrollClass).not.toHaveBeenCalled(); // checking a code writes nothing

      await act(async () => flow.actions.proceed());
      await settle();

      expect(api.enrollClass).toHaveBeenCalledWith("c1", null);
      expect(api.redeemDiscountCode).toHaveBeenCalledWith({
        code: "DC-ABCD-2345",
        enrollmentId: "e1",
        enrollmentPackageId: "p1",
      });
      expect(api.enrollClass.mock.invocationCallOrder[0]).toBeLessThan(
        api.redeemDiscountCode.mock.invocationCallOrder[0],
      );
      expect(api.createPaymentIntent).not.toHaveBeenCalled();
      expect(api.getPaymentQrCode).not.toHaveBeenCalled();
      expect(flow.step).toBe("success");
      expect(flow.amountSatang).toBe(0);
      expect(flow.receiptMethod).toBe("DISCOUNT_CODE");
      expect(flow.lessonClassId).toBe("c1");
      expect(flow.loading).toBe(false);
      expect(invalidateResource).toHaveBeenCalledWith("u1:");
    });

    it("paid outside the app: ฿0 to pay now, the receipt shows the amount recorded on the payment", async () => {
      const paidOffline = { ...QUOTE, offlinePaidSatang: 320000 };
      api.previewDiscountCode.mockResolvedValue({ discount: paidOffline });
      api.redeemDiscountCode.mockResolvedValue({
        ...REDEEMED,
        intent: { ...REDEEMED.intent, amountMinor: 320000 },
        discount: paidOffline,
      });
      api.enrollClass.mockResolvedValue({ ...PENDING_ENROLLMENT, classId: "c1" });
      await render();

      await applyCode();
      expect(flow.discount.quote).toEqual(paidOffline);
      // Same checkout as a free code: nothing to pay in the app.
      expect(flow.discount.free).toBe(true);
      expect(flow.amountSatang).toBe(0);

      await act(async () => flow.actions.proceed());
      await settle();
      expect(api.createPaymentIntent).not.toHaveBeenCalled();
      expect(flow.step).toBe("success");
      expect(flow.amountSatang).toBe(320000);
      expect(flow.receiptMethod).toBe("DISCOUNT_CODE");
    });

    it("book cycle: the quote and the redeem use the cycle package", async () => {
      api.previewDiscountCode.mockResolvedValue({
        discount: { ...QUOTE, cycleId: "cy1", originalAmountSatang: 180000, discountSatang: 180000 },
      });
      api.prepareClassBookCycleAccess.mockResolvedValue({ ...PENDING_ENROLLMENT, enrollmentPackageId: "p2" });
      await render(params({ cycleId: "cy1" }));

      await applyCode();
      expect(api.previewDiscountCode).toHaveBeenCalledWith({ code: "DC-ABCD-2345", classId: "c1", cycleId: "cy1" });
      expect(flow.discount.free).toBe(true);

      await act(async () => flow.actions.proceed());
      await settle();
      expect(api.prepareClassBookCycleAccess).toHaveBeenCalledWith("c1", "cy1");
      expect(api.redeemDiscountCode).toHaveBeenCalledWith(expect.objectContaining({ enrollmentPackageId: "p2" }));
      expect(flow.step).toBe("success");
      expect(flow.lessonClassId).toBe("c1");
    });

    it("a code rejected at redeem returns from the age check to select with the error on the field", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      api.getCurrentUser.mockResolvedValue({ user: {} }); // no saved birthday → age check
      api.updateProfile.mockResolvedValue({ user: { requiresGuardian: false } });
      api.redeemDiscountCode.mockRejectedValue(apiError(409, "DISCOUNT_CODE_USED_UP"));
      await render();
      await applyCode();

      await act(async () => flow.actions.proceed());
      expect(flow.step).toBe("age-check");
      expect(api.enrollClass).not.toHaveBeenCalled();

      await act(async () => flow.ageCheck.setDateOfBirth("1990-01-01"));
      await act(async () => flow.actions.submitAgeCheck());
      await settle();

      expect(api.updateProfile).toHaveBeenCalledWith("1990-01-01");
      expect(api.enrollClass).toHaveBeenCalledTimes(1);
      expect(api.redeemDiscountCode).toHaveBeenCalledTimes(1);
      expect(flow.step).toBe("select");
      expect(flow.discount.errorKey).toBe("payment.discount.errors.usedUp");
      expect(t(flow.discount.errorKey ?? "payment.select.title")).toBe("โค้ดนี้ถูกใช้ครบจำนวนแล้ว");
      // The code is no longer valid: back to the full price, keeping what was typed.
      expect(flow.discount.quote).toBeNull();
      expect(flow.discount.free).toBe(false);
      expect(flow.discount.code).toBe("DC-ABCD-2345");
      expect(flow.amountSatang).toBe(320000);
      expect(flow.loading).toBe(false);
      expect(toast.error).not.toHaveBeenCalled();

      // Editing the field clears the error.
      await act(async () => flow.discount.setCode("DC-ABCD-234"));
      expect(flow.discount.errorKey).toBeNull();
    });

    it("a payment still in progress keeps the code applied and shows the message on the field", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      api.redeemDiscountCode.mockRejectedValue(apiError(409, "PAYMENT_IN_PROGRESS"));
      await render();
      await applyCode();
      await act(async () => flow.actions.proceed());
      await settle();

      expect(flow.step).toBe("select");
      expect(flow.discount.errorKey).toBe("payment.errors.paymentInProgress");
      expect(flow.discount.quote).toEqual(QUOTE);
      expect(flow.discount.free).toBe(true);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("other checkout errors keep the existing toast", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      api.enrollClass.mockRejectedValue(apiError(409, "CLASS_FULL"));
      await render();
      await applyCode();
      await act(async () => flow.actions.proceed());
      await settle();

      expect(api.redeemDiscountCode).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(t("payment.errors.classFull"));
      expect(flow.discount.errorKey).toBeNull();
      expect(flow.discount.free).toBe(true);
      expect(flow.step).toBe("select");
    });

    it("an already-active enrollment goes straight to success without using the code", async () => {
      api.enrollClass.mockResolvedValue({ status: "ACTIVE", enrollmentId: "e1", classId: "c1" });
      await render();
      await applyCode();
      await act(async () => flow.actions.proceed());
      await settle();

      expect(flow.step).toBe("success");
      expect(api.redeemDiscountCode).not.toHaveBeenCalled();
      expect(api.createPaymentIntent).not.toHaveBeenCalled();
      expect(flow.amountSatang).toBe(0);
      expect(flow.receiptMethod).toBe("DISCOUNT_CODE");
    });

    it("shows preview errors on the field and waits for the check before proceeding", async () => {
      api.previewDiscountCode.mockRejectedValueOnce(apiError(404, "DISCOUNT_CODE_NOT_FOUND"));
      await render();
      await applyCode("DC-WRONG");
      expect(flow.discount.errorKey).toBe("payment.discount.errors.notFound");
      expect(flow.discount.quote).toBeNull();
      expect(flow.discount.applying).toBe(false);

      api.previewDiscountCode.mockRejectedValueOnce(apiError(429));
      await applyCode("DC-WRONG");
      expect(flow.discount.errorKey).toBe("payment.discount.errors.tooManyAttempts");

      let resolvePreview: (value: unknown) => void = () => {};
      api.previewDiscountCode.mockReturnValueOnce(new Promise((resolve) => (resolvePreview = resolve)));
      await act(async () => flow.discount.setCode("DC-ABCD-2345"));
      expect(flow.discount.errorKey).toBeNull();
      await act(async () => void flow.actions.applyDiscountCode());
      expect(flow.discount.applying).toBe(true);
      expect(flow.canProceed).toBe(false);
      await act(async () => flow.actions.proceed());
      expect(api.enrollClass).not.toHaveBeenCalled();

      await act(async () => resolvePreview({ discount: QUOTE }));
      await settle();
      expect(flow.discount.applying).toBe(false);
      expect(flow.canProceed).toBe(true);
      expect(flow.discount.free).toBe(true);

      // × removes the code: the paid flow is back, unchanged.
      await act(async () => flow.actions.removeDiscountCode());
      expect(flow.discount.quote).toBeNull();
      expect(flow.discount.code).toBe("");
      expect(flow.amountSatang).toBe(320000);
      await act(async () => flow.actions.proceed());
      await settle();
      expect(api.redeemDiscountCode).not.toHaveBeenCalled();
      expect(api.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amountSatang: 320000, method: "promptpay" }),
      );
      expect(flow.step).toBe("qr");
    });

    it("checks a typed code that was not applied before any checkout starts", async () => {
      await render();
      await act(async () => flow.discount.setCode("dc-abcd-2345"));

      // The main button with an unapplied code: the code is checked, nothing is paid yet.
      await act(async () => flow.actions.proceed());
      await settle();
      expect(api.previewDiscountCode).toHaveBeenCalledWith({ code: "DC-ABCD-2345", classId: "c1", cycleId: undefined });
      expect(api.enrollClass).not.toHaveBeenCalled();
      expect(api.createPaymentIntent).not.toHaveBeenCalled();
      expect(flow.step).toBe("select");
      expect(flow.discount.free).toBe(true);

      // The next tap is the ฿0 checkout.
      await act(async () => flow.actions.proceed());
      await settle();
      expect(api.redeemDiscountCode).toHaveBeenCalledTimes(1);
      expect(api.createPaymentIntent).not.toHaveBeenCalled();
      expect(flow.step).toBe("success");
    });

    it("keeps a rejected typed code from falling through to a full-price checkout", async () => {
      api.previewDiscountCode.mockRejectedValue(apiError(404, "DISCOUNT_CODE_NOT_FOUND"));
      await render();
      await act(async () => flow.discount.setCode("DC-WRONG"));
      await act(async () => flow.actions.proceed());
      await settle();

      expect(flow.discount.errorKey).toBe("payment.discount.errors.notFound");
      expect(api.enrollClass).not.toHaveBeenCalled();
      expect(api.createPaymentIntent).not.toHaveBeenCalled();
      expect(flow.step).toBe("select");

      // Clearing the field brings back the paid checkout.
      await act(async () => flow.discount.setCode(""));
      await act(async () => flow.actions.proceed());
      await settle();
      expect(api.previewDiscountCode).toHaveBeenCalledTimes(1);
      expect(api.createPaymentIntent).toHaveBeenCalledTimes(1);
      expect(flow.step).toBe("qr");
    });

    it("ignores a quote for another class and offers no code on a referral-only link", async () => {
      api.previewDiscountCode.mockResolvedValue({ discount: { ...QUOTE, classId: "c-other" } });
      await render();
      await applyCode();
      expect(flow.discount.quote).toBeNull();
      expect(flow.discount.errorKey).toBe("payment.discount.errors.checkFailed");
      act(() => root.unmount());

      root = createRoot(container);
      await render(params({ classId: "", referralToken: "tok" }));
      expect(flow.discount.available).toBe(false);
      expect(flow.lessonClassId).toBeNull();
      await applyCode();
      expect(api.previewDiscountCode).toHaveBeenCalledTimes(1);
    });
  });

  describe("with fake timers", () => {
    const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

    beforeEach(() => {
      vi.useFakeTimers();
    });

    const renderAndCreateQr = async () => {
      await act(async () => root.render(<Probe {...params()} />));
      await advance(0);
      await act(async () => flow.actions.acceptPolicy(true));
      await act(async () => flow.actions.proceed());
      await advance(0);
      expect(flow.qr.polling).toBe(true);
    };

    it("polls every 5s without overlap and shows success when paid", async () => {
      await renderAndCreateQr();
      api.getPaymentStatus.mockClear();

      await advance(4_900);
      expect(api.getPaymentStatus).not.toHaveBeenCalled();
      await advance(100);
      expect(api.getPaymentStatus).toHaveBeenCalledTimes(1);
      expect(api.getPaymentStatus).toHaveBeenCalledWith("pi1");

      api.getPaymentStatus.mockResolvedValue(intentResponse({ status: "SUCCESS" }));
      await advance(5_000);
      expect(flow.step).toBe("success");
      expect(flow.qr.polling).toBe(false);
      expect(invalidateResource).toHaveBeenCalledWith("u1:");
    });

    it("pauses while LINE is hidden and checks at once when the student comes back", async () => {
      let visibility: DocumentVisibilityState = "visible";
      const spy = vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
      await renderAndCreateQr();
      api.getPaymentStatus.mockClear();

      visibility = "hidden";
      await act(async () => document.dispatchEvent(new Event("visibilitychange")));
      await advance(60_000);
      expect(api.getPaymentStatus).not.toHaveBeenCalled();

      api.getPaymentStatus.mockResolvedValue(intentResponse({ status: "SUCCESS" }));
      visibility = "visible";
      await act(async () => document.dispatchEvent(new Event("visibilitychange")));
      await advance(0);
      expect(api.getPaymentStatus).toHaveBeenCalledTimes(1);
      expect(flow.step).toBe("success");
      spy.mockRestore();
    });

    it("expires a QR on return when the deadline passed while LINE was in the background", async () => {
      let visibility: DocumentVisibilityState = "visible";
      const spy = vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
      await renderAndCreateQr();
      visibility = "hidden";
      await act(async () => document.dispatchEvent(new Event("visibilitychange")));
      // Throttled background timers: only the clock moves.
      vi.setSystemTime(Date.now() + QR_LIFETIME_MS + 1_000);
      visibility = "visible";
      await act(async () => document.dispatchEvent(new Event("visibilitychange")));
      await advance(0);
      expect(flow.qr.expired).toBe(true);
      expect(flow.qr.ctaMode).toBe("regenerate");
      spy.mockRestore();
    });

    it("still expires when the expiry timer wakes up before the deadline (clock moved back)", async () => {
      await renderAndCreateQr();
      // The wall clock jumps back a minute (NTP/user change): the timer fires
      // while Date.now() is still before the deadline.
      vi.setSystemTime(Date.now() - 60_000);
      await advance(QR_LIFETIME_MS);
      expect(flow.qr.expired).toBe(false);
      await advance(60_000);
      expect(flow.qr.expired).toBe(true);
      expect(flow.qr.polling).toBe(false);
    });

    it("stops polling when the QR expires and regenerates through the create path", async () => {
      await renderAndCreateQr();
      await advance(QR_LIFETIME_MS);
      expect(flow.qr.expired).toBe(true);
      expect(flow.qr.polling).toBe(false);
      expect(flow.qr.ctaMode).toBe("regenerate");

      api.getPaymentStatus.mockClear();
      await advance(30_000);
      expect(api.getPaymentStatus).not.toHaveBeenCalled();

      api.createPaymentIntent.mockResolvedValue(intentResponse({ paymentIntentId: "pi2" }));
      api.getPaymentQrCode.mockResolvedValue({ chargeId: "ch2", dataUri: "data:image/png;base64,NEW" });
      await act(async () => flow.actions.regenerateQr());
      await advance(0);

      expect(api.enrollClass).toHaveBeenCalledTimes(2);
      expect(api.createPaymentIntent).toHaveBeenCalledTimes(2);
      expect(api.getPaymentStatus).not.toHaveBeenCalled(); // no verify of the old intent
      expect(flow.paymentIntentId).toBe("pi2");
      expect(flow.qr.dataUri).toBe("data:image/png;base64,NEW");
      expect(flow.qr.expired).toBe(false);
      expect(flow.qr.ctaMode).toBe("verify");
    });

    it("manual check: pending toasts and resumes polling; failed stops it", async () => {
      await renderAndCreateQr();

      await act(async () => void flow.actions.confirmPayment());
      await advance(0);
      expect(toast.info).toHaveBeenCalledWith("ยังไม่เห็นยอดเงินเข้า ถ้าจ่ายแล้ว รอสักครู่แล้วกดตรวจสอบอีกครั้งนะ");
      expect(flow.qr.polling).toBe(true);

      vi.spyOn(console, "error").mockImplementation(() => {});
      api.getPaymentStatus.mockResolvedValue(intentResponse({ status: "FAILED" }));
      await act(async () => void flow.actions.confirmPayment());
      await advance(0);
      expect(flow.qr.failed).toBe(true);
      expect(flow.qr.polling).toBe(false);
      expect(flow.qr.ctaMode).toBe("regenerate");
      expect(toast.error).toHaveBeenCalledTimes(1);

      api.getPaymentStatus.mockClear();
      await advance(20_000);
      expect(api.getPaymentStatus).not.toHaveBeenCalled();
    });
  });
});
