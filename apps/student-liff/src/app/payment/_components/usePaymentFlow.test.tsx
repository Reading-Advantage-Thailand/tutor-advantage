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
  const render = async (props: PaymentFlowParams = params()) => {
    await act(async () => root.render(<Probe {...props} />));
    await settle();
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
      expect.objectContaining({ amountSatang: 250000, returnUri: "http://localhost:3000/payment?referralToken=tok" }),
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

  describe("with fake timers", () => {
    const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

    beforeEach(() => {
      vi.useFakeTimers();
    });

    const renderAndCreateQr = async () => {
      await act(async () => root.render(<Probe {...params()} />));
      await advance(0);
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
