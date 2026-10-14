"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
// Relative imports: the root vitest config maps "@" to another app.
import { useLiff } from "../../../components/providers/LiffProvider";
import { studentApi } from "../../../lib/api";
import { invalidateResource } from "../../../lib/cachedResource";
import { t } from "../../../lib/i18n";
import {
  buildEnrollmentFirstPath,
  buildPaymentOrder,
  buildPaymentReturnUri,
  canSubmitAgeCheck,
  createDefaultOrderSummary,
  createUnknownOrderDisplay,
  formatCardExpiry,
  formatCardNumber,
  getCardResultStatus,
  getChargeFailureKey,
  getDisplayAmountSatang,
  getPaymentErrorKey,
  getProceedStep,
  getQrCtaMode,
  getReturnedPaymentStep,
  isEnrollmentFirstError,
  isValidDateOfBirth,
  mergeCheckoutDetails,
  needsGuardianConsent,
  normalizePaymentMethod,
  PaymentFlowError,
  paymentStepForMethod,
  sanitizeCardCvv,
  shouldLoadPromptPayQr,
  withQrCodeDataUri,
  type CardFields,
  type CheckoutDetails,
  type OrderDisplay,
  type OrderSummary,
  type PaymentMethod,
  type PaymentRouteParams,
  type PaymentStatusResponse,
  type PaymentStep,
  type QrCtaMode,
} from "../../../lib/paymentFlow";
import {
  createOmiseCardToken,
  loadOmiseScript,
  redirectToAuthorizeUri,
  type PaymentGatewayConfig,
} from "./omise";
import { useQrPayment } from "./useQrPayment";
import { useStepHistory } from "./useStepHistory";

export type PaymentFlowParams = PaymentRouteParams & {
  /** `paymentIntentId` from the URL (3DS return or a resumed checkout). */
  returnedPaymentIntentId: string | null;
};

export type LoadStatus = "loading" | "ready" | "error";

type IntentLike = PaymentStatusResponse["intent"];

const SUB_STEPS: ReadonlySet<PaymentStep> = new Set(["age-check", "qr", "card-form"]);

const EMPTY_CARD: CardFields = { number: "", name: "", expiry: "", cvv: "" };

/**
 * The whole checkout state machine (select → age check → PromptPay QR or card
 * form → result/success) without any markup. Step components get its values
 * and actions as props.
 *
 * API calls, payloads, the enrollment choice (cycle > referral > direct),
 * returnUri, the 3DS redirect and the amount fallback are the same as the
 * original page; the deliberate fixes are documented where they happen.
 */
export function usePaymentFlow({ classId, cycleId, referralToken, returnedPaymentIntentId }: PaymentFlowParams) {
  const router = useRouter();
  const { profile } = useLiff();

  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [step, setStepState] = useState<PaymentStep>("select");
  // Handlers read the latest step after awaits (no stale closures).
  const stepRef = useRef<PaymentStep>("select");
  const setStep = useCallback((next: PaymentStep) => {
    stepRef.current = next;
    setStepState(next);
  }, []);

  // Card fields live only in memory (never persisted, never in the URL/history state).
  const [card, setCard] = useState<CardFields>(EMPTY_CARD);

  /** One shared busy flag for age-check save, status checks and payment creation (as before). */
  const [loading, setLoading] = useState(false);
  // Double-submit guard: blocks a second tap before React re-renders the disabled button.
  const busyRef = useRef(false);
  /** Set while the browser leaves for the bank's 3DS page. */
  const [redirectUri, setRedirectUri] = useState<string | null>(null);
  const redirectingRef = useRef(false);

  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(returnedPaymentIntentId);
  const intentIdRef = useRef<string | null>(returnedPaymentIntentId);
  /** The intent's own amount (satang) once an intent exists. */
  const [intentAmountSatang, setIntentAmountSatang] = useState<number | null>(null);
  const [checkout, setCheckout] = useState<CheckoutDetails | null>(null);
  const [cardResult, setCardResult] = useState<"pending" | "failed">("pending");
  const [qrFailed, setQrFailedState] = useState(false);
  const qrFailedRef = useRef(false);
  /** The returned-intent check (3DS return) is running. */
  const [resuming, setResuming] = useState(Boolean(returnedPaymentIntentId));

  // ── Class / order ──
  const [classStatus, setClassStatus] = useState<LoadStatus>(classId ? "loading" : "ready");
  /** The order the intent payload uses (keeps the old DEFAULT_PRICE fallback for amountSatang). */
  const [order, setOrder] = useState<OrderSummary>(() => createDefaultOrderSummary(classId));
  /** What the screens show; the price is null when unknown (never the fallback). */
  const [display, setDisplay] = useState<OrderDisplay>(createUnknownOrderDisplay);
  const [classAttempt, setClassAttempt] = useState(0);

  // ── Age / guardian ──
  const [profileStatus, setProfileStatus] = useState<LoadStatus>("loading");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [consentAlreadyGiven, setConsentAlreadyGiven] = useState(false);

  const setIntent = useCallback((intent: IntentLike | null) => {
    intentIdRef.current = intent?.paymentIntentId ?? null;
    setPaymentIntentId(intentIdRef.current);
    if (!intent) setIntentAmountSatang(null);
    else if (typeof intent.amountMinor === "number") setIntentAmountSatang(intent.amountMinor);
  }, []);

  const mergeCheckout = useCallback((next: CheckoutDetails | null) => {
    setCheckout((prev) => mergeCheckoutDetails(prev, next));
  }, []);

  const setQrFailed = useCallback((failed: boolean) => {
    qrFailedRef.current = failed;
    setQrFailedState(failed);
  }, []);

  const qr = useQrPayment({
    onStatus: (status) => mergeCheckout(status.checkout),
    onPaid: () => setStep("success"),
    onFailed: (status) => {
      if (qrFailedRef.current) return;
      setQrFailed(true);
      toast.error(t(getChargeFailureKey(status.checkout?.failureMessage, "promptpay")));
    },
    onQrCode: (code) => setCheckout((prev) => withQrCodeDataUri(prev, code)),
  });

  // Hardware back / edge swipe from a sub-step returns to the method screen.
  const stepHistory = useStepHistory(() => {
    if (redirectingRef.current) return;
    const current = stepRef.current;
    if (current === "success" || current === "result") return;
    setStep("select");
  });

  /** Shows a step; sub-steps get one history entry (see useStepHistory). */
  const showStep = useCallback(
    (next: PaymentStep) => {
      setStep(next);
      if (SUB_STEPS.has(next)) stepHistory.enterSubStep(next);
    },
    [setStep, stepHistory],
  );

  // E1: class details (with the book-cycle override). A failure now shows an
  // error with retry instead of silently keeping the 2,500 fallback on screen.
  useEffect(() => {
    if (!classId) return;
    let active = true;
    setClassStatus("loading");
    studentApi
      .getClassDetails(classId)
      .then((data) => {
        if (!active) return;
        if (!data?.class) {
          setClassStatus("error");
          return;
        }
        const built = buildPaymentOrder(data.class, classId, cycleId);
        setOrder(built.order);
        setDisplay(built.display);
        setClassStatus("ready");
      })
      .catch((error) => {
        console.error("Could not load class details for payment:", error);
        if (active) setClassStatus("error");
      });
    return () => {
      active = false;
    };
  }, [classId, cycleId, classAttempt]);

  const retryClass = useCallback(() => setClassAttempt((attempt) => attempt + 1), []);

  // E2: saved date of birth + guardian consent. Errors fall through to the
  // age check as before; "proceed" waits for this so adults are not sent there.
  useEffect(() => {
    let active = true;
    Promise.all([studentApi.getCurrentUser(), studentApi.checkGuardianConsent()])
      .then(([user, consent]) => {
        if (!active) return;
        if (user?.user?.dateOfBirth) setDateOfBirth(user.user.dateOfBirth);
        setConsentAlreadyGiven(Boolean(consent?.hasConsent));
        setProfileStatus("ready");
      })
      .catch(() => {
        // Non-critical: if the check fails, fall through to the age check.
        if (active) setProfileStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  // E3: returned intent (3DS return URL carries paymentIntentId).
  useEffect(() => {
    if (!returnedPaymentIntentId) return;
    let active = true;
    setLoading(true);
    studentApi
      .getPaymentStatus(returnedPaymentIntentId)
      .then((data: PaymentStatusResponse) => {
        if (!active) return;
        setIntent(data.intent);
        mergeCheckout(data.checkout);
        // Fix: restore the method so a card return shows the card result
        // (and a card receipt), not the PromptPay screen.
        const returnedMethod = normalizePaymentMethod(data.intent.method);
        if (returnedMethod) setMethod(returnedMethod);
        const next = getReturnedPaymentStep(data.intent);
        if (next === "result") setCardResult(getCardResultStatus(data.intent.status));
        setStep(next);
        if (shouldLoadPromptPayQr(data.intent)) {
          qr.loadQr(data.intent.paymentIntentId).catch((error) => {
            console.error("Could not load the PromptPay QR:", error);
          });
        }
      })
      .catch((error) => {
        console.error("Could not verify returned payment:", error);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setResuming(false);
      });
    return () => {
      active = false;
    };
    // qr.loadQr, setIntent, setStep and mergeCheckout are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedPaymentIntentId]);

  // Fix: Home/classes/history show the new enrollment right away.
  const userId = profile?.userId;
  useEffect(() => {
    if (step !== "success") return;
    invalidateResource(userId ? `${userId}:` : () => true);
  }, [step, userId]);

  // A bfcache restore after leaving for 3DS (back from the bank page) must not
  // stay stuck on the redirect screen.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !redirectingRef.current) return;
      redirectingRef.current = false;
      busyRef.current = false;
      setRedirectUri(null);
      setLoading(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // ── Card gateway (prefetched when the card form opens) ──
  const gatewayConfigRef = useRef<Promise<PaymentGatewayConfig> | null>(null);
  const getGatewayConfig = useCallback(() => {
    if (!gatewayConfigRef.current) {
      const request = studentApi.getPaymentConfig() as Promise<PaymentGatewayConfig>;
      gatewayConfigRef.current = request;
      const forget = () => {
        if (gatewayConfigRef.current === request) gatewayConfigRef.current = null;
      };
      // Not configured or failed: ask again on the next tap (as before, every tap asked).
      request.then((config) => {
        if (!config?.configured || !config.publicKey) forget();
      }, forget);
    }
    return gatewayConfigRef.current;
  }, []);

  useEffect(() => {
    if (step !== "card-form") return;
    getGatewayConfig().catch(() => {});
    loadOmiseScript().catch(() => {});
  }, [step, getGatewayConfig]);

  const ensureOmiseToken = async () => {
    const config = await getGatewayConfig();
    if (!config?.configured || !config.publicKey) {
      throw new PaymentFlowError("gateway");
    }
    await loadOmiseScript();
    return createOmiseCardToken(config.publicKey, card);
  };

  const verifyPaymentStatus = async (intentId: string) => {
    const status = (await studentApi.getPaymentStatus(intentId)) as PaymentStatusResponse;
    mergeCheckout(status.checkout);
    if (status.intent.status === "SUCCESS") {
      setStep("success");
      return;
    }
    if (status.intent.status === "FAILED") {
      throw new PaymentFlowError("failed", status.checkout?.failureMessage);
    }
    toast.info(t("payment.errors.paymentPending"));
  };

  /** Enroll (cycle > referral > direct) → intent → success / 3DS / QR. */
  const createPayment = async () => {
    const enrollment = cycleId
      ? await studentApi.prepareClassBookCycleAccess(classId, cycleId)
      : referralToken
        ? await studentApi.enrollByReferral(referralToken)
        : await studentApi.enrollClass(classId, referralToken);
    if (enrollment.status === "ACTIVE") {
      setStep("success");
      return;
    }

    const omiseToken = method === "card" ? await ensureOmiseToken() : undefined;
    const payment = (await studentApi.createPaymentIntent({
      enrollmentId: enrollment.enrollmentId,
      enrollmentPackageId: enrollment.enrollmentPackageId,
      amountSatang: enrollment.amountSatang || order.priceSatang,
      method,
      omiseToken,
      // classId/cycleId/referralToken let the 3DS return resume the payment.
      returnUri: buildPaymentReturnUri(window.location.href, { classId, cycleId, referralToken }),
    })) as PaymentStatusResponse;

    setIntent(payment.intent);
    mergeCheckout(payment.checkout);

    if (payment.intent.status === "SUCCESS" || payment.checkout?.paid) {
      setStep("success");
      return;
    }

    if (payment.checkout?.authorizeUri && method === "card") {
      // Fix: keep the button busy while the webview navigates (no second intent).
      redirectingRef.current = true;
      setRedirectUri(payment.checkout.authorizeUri);
      redirectToAuthorizeUri(payment.checkout.authorizeUri);
      return;
    }

    if (method === "promptpay") {
      if (stepRef.current !== "qr") showStep("qr");
      await qr.loadQr(payment.intent.paymentIntentId);
      return;
    }

    throw new PaymentFlowError(
      payment.intent.status === "FAILED" ? "failed" : "incomplete",
      payment.checkout?.failureMessage,
    );
  };

  const handlePaymentError = (err: unknown) => {
    console.error("Payment/Enrollment failed:", err);
    if (cycleId && isEnrollmentFirstError(err)) {
      // No active class enrollment yet: pay for the class first. The page is
      // keyed by its query, so this starts a fresh checkout (like the old reload).
      router.replace(buildEnrollmentFirstPath(classId, referralToken));
      return;
    }
    toast.error(t(getPaymentErrorKey(err, method)));
  };

  /**
   * The main button on the QR and card screens: checks an existing PromptPay
   * intent, otherwise creates the payment.
   */
  const runCheckout = async () => {
    if (busyRef.current || redirectingRef.current) return;
    const intentId = intentIdRef.current;
    const verifying = method === "promptpay" && intentId !== null;
    qr.stopPolling(); // no automatic check while checking by hand
    busyRef.current = true;
    setLoading(true);
    try {
      if (verifying) {
        await verifyPaymentStatus(intentId);
        return;
      }
      await createPayment();
    } catch (err) {
      if (verifying && err instanceof PaymentFlowError && err.kind === "failed") {
        const alreadyShown = qrFailedRef.current; // the automatic check already said so
        setQrFailed(true);
        if (alreadyShown) return;
      }
      handlePaymentError(err);
    } finally {
      // Fix: during the 3DS redirect the button stays busy.
      if (!redirectingRef.current) {
        busyRef.current = false;
        setLoading(false);
      }
      // Resume the automatic check after a manual one, unless the step moved
      // on (success) or the payment failed (it would only toast again).
      if (
        verifying &&
        stepRef.current === "qr" &&
        intentIdRef.current === intentId &&
        !qrFailedRef.current
      ) {
        qr.startPolling(intentId);
      }
    }
  };

  // ── Actions ──

  const canProceed = classStatus === "ready" && profileStatus !== "loading" && !resuming;

  const proceed = () => {
    if (!canProceed || busyRef.current) return;
    const next = getProceedStep(dateOfBirth, consentAlreadyGiven, method);
    showStep(next);
    // PromptPay: create the QR right away (one tap instead of two).
    if (next === "qr" && !intentIdRef.current) void runCheckout();
  };

  const submitAgeCheck = async () => {
    if (!isValidDateOfBirth(dateOfBirth)) {
      toast.error(t("payment.errors.dateOfBirthRequired"));
      return;
    }
    if (busyRef.current) return;

    busyRef.current = true;
    setLoading(true);
    let next: PaymentStep | null = null;
    try {
      const user = await studentApi.updateProfile(dateOfBirth);
      if (user?.user?.requiresGuardian) {
        if (!guardianName.trim() || !guardianRelation.trim()) {
          toast.error(t("payment.errors.guardianRequired"));
          return;
        }
        await studentApi.submitGuardianConsent(guardianName, guardianRelation);
        setConsentAlreadyGiven(true);
      }
      next = paymentStepForMethod(method);
    } catch (error) {
      console.error("Error saving consent:", error);
      toast.error(t("payment.errors.consentFailed"));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
    if (!next) return;
    showStep(next);
    if (next === "qr" && !intentIdRef.current) void runCheckout();
  };

  /** Clears the current intent/QR so the next checkout creates a new one. */
  const forgetIntent = () => {
    qr.reset();
    setQrFailed(false);
    setIntent(null);
    setCheckout(null);
  };

  /** Fix: an expired/failed QR offers "สร้าง QR ใหม่" (new intent via the same create path). */
  const regenerateQr = () => {
    if (busyRef.current || redirectingRef.current) return;
    forgetIntent();
    void runCheckout();
  };

  const retryQrImage = () => {
    const intentId = intentIdRef.current;
    if (!intentId || qr.loading) return;
    qr.loadQr(intentId).catch((error) => {
      console.error("Could not load the PromptPay QR:", error);
    });
  };

  /** Card result screen (3DS return): ask for the status again. */
  const checkCardResult = async () => {
    const intentId = intentIdRef.current;
    if (!intentId || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const status = (await studentApi.getPaymentStatus(intentId)) as PaymentStatusResponse;
      mergeCheckout(status.checkout);
      if (status.intent.status === "SUCCESS") {
        setStep("success");
      } else if (status.intent.status === "FAILED") {
        setCardResult("failed");
      } else {
        toast.info(t("payment.errors.paymentPending"));
      }
    } catch (err) {
      console.error("Could not check the card payment:", err);
      toast.error(t(getPaymentErrorKey(err, "card")));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  /** Card result screen: pay again with a card (new intent). */
  const retryCard = () => {
    if (busyRef.current) return;
    forgetIntent();
    setCardResult("pending");
    setMethod("card");
    showStep("card-form");
  };

  /** Back to the method screen. The QR check keeps running (a payment in flight can still finish). */
  const backToSelect = () => {
    if (busyRef.current && stepRef.current === "result") return;
    if (stepRef.current === "result") {
      forgetIntent();
      setCardResult("pending");
    }
    setStep("select");
    stepHistory.leaveSubStep();
  };

  const selectMethod = (next: PaymentMethod) => {
    if (busyRef.current) return;
    setMethod(next);
  };

  const ageCheckFields = { dateOfBirth, guardianName, guardianRelation, consentAlreadyGiven };
  const qrCtaMode: QrCtaMode = getQrCtaMode({
    hasIntent: paymentIntentId !== null,
    busy: loading,
    qrLoading: qr.loading,
    expired: qr.expired,
    failed: qrFailed,
  });

  return {
    step,
    method,
    loading,
    resuming,
    redirectUri,

    classStatus,
    display,
    retryClass,
    profileLoading: profileStatus === "loading",
    canProceed,
    /** Intent amount once an intent exists, otherwise the class/cycle price (null = unknown). */
    amountSatang: getDisplayAmountSatang(intentAmountSatang, display.priceSatang),

    paymentIntentId,
    checkout,
    cardResult,

    qr: {
      ctaMode: qrCtaMode,
      loading: qr.loading,
      error: qr.error,
      expiresAt: qr.expiresAt,
      expired: qr.expired,
      failed: qrFailed,
      polling: qr.polling,
      dataUri: checkout?.qrCodeDataUri ?? null,
    },

    ageCheck: {
      ...ageCheckFields,
      needsGuardian: needsGuardianConsent(dateOfBirth, consentAlreadyGiven),
      canSubmit: canSubmitAgeCheck(ageCheckFields),
      setDateOfBirth,
      setGuardianName,
      setGuardianRelation,
    },

    card: {
      ...card,
      setNumber: (value: string) => setCard((prev) => ({ ...prev, number: formatCardNumber(value) })),
      setName: (value: string) => setCard((prev) => ({ ...prev, name: value.toUpperCase() })),
      setExpiry: (value: string) => setCard((prev) => ({ ...prev, expiry: formatCardExpiry(value) })),
      setCvv: (value: string) => setCard((prev) => ({ ...prev, cvv: sanitizeCardCvv(value) })),
    },

    actions: {
      selectMethod,
      proceed,
      submitAgeCheck,
      confirmPayment: runCheckout,
      regenerateQr,
      retryQrImage,
      checkCardResult,
      retryCard,
      backToSelect,
    },
  };
}

export type PaymentFlow = ReturnType<typeof usePaymentFlow>;
