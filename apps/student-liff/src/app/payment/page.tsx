"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  ChevronLeft,
  Shield,
  CheckCircle2,
  CreditCard,
  QrCode,
  Clock,
  ChevronRight,
} from "lucide-react";
import { studentApi } from "@/lib/api";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  buildOrderSummaryFromClass,
  createDefaultOrderSummary,
  formatCardExpiry,
  formatCardNumber,
  getReturnedPaymentStep,
  mergeCheckoutDetails,
  shouldLoadPromptPayQr,
  type CheckoutDetails,
  type OrderSummary,
  type PaymentMethod,
  type PaymentStep,
} from "@/lib/paymentFlow";

declare global {
  interface Window {
    Omise?: {
      setPublicKey: (key: string) => void;
      createToken: (
        type: "card",
        payload: Record<string, string | number>,
        callback: (
          statusCode: number,
          response: { id?: string; message?: string },
        ) => void,
      ) => void;
    };
  }
}

function loadOmiseScript() {
  if (window.Omise) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[src='https://cdn.omise.co/omise.js']",
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(t("payment.errors.loadOmiseScript"))),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.omise.co/omise.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(t("payment.errors.loadOmiseScript")));
    document.head.appendChild(script);
  });
}

function PaymentFlow() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId") ?? "";
  const cycleId = searchParams.get("cycleId") ?? "";
  const referralToken = searchParams.get("referralToken");
  const returnedPaymentIntentId = searchParams.get("paymentIntentId");

  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [step, setStep] = useState<PaymentStep>("select");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(
    returnedPaymentIntentId,
  );
  const [checkout, setCheckout] = useState<CheckoutDetails | null>(null);
  const qrPollRef = useRef<NodeJS.Timeout | null>(null);

  const [cls, setCls] = useState<OrderSummary>(createDefaultOrderSummary(classId));

  // Guard: no classId in URL → redirect back to classes list
  if (!classId && !referralToken) {
    if (typeof window !== "undefined") {
      window.location.href = "/classes";
    }
    return null;
  }

  useEffect(() => {
    let isMounted = true;

    if (!classId) return;

    studentApi
      .getClassDetails(classId)
      .then((data) => {
        if (!isMounted || !data?.class) return;
        const cycle = cycleId
          ? data.class.bookCycles?.find((item: any) => item.id === cycleId)
          : null;
        if (cycle) {
          setCls({
            id: classId,
            name: `${data.class.name} / ${cycle.title}`,
            price: cycle.price,
            priceSatang: cycle.packagePriceSatang,
            tutor: data.class.tutor?.name || t("payment.defaultTutor"),
            cefr: cycle.cefr || data.class.cefr || t("payment.defaultCefr"),
          });
          return;
        }
        setCls(buildOrderSummaryFromClass(data.class, classId));
      })
      .catch((error) => {
        console.error("Could not load class details for payment:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [classId, cycleId]);

  useEffect(() => {
    if (!returnedPaymentIntentId) return;

    let isMounted = true;
    setLoading(true);
    studentApi
      .getPaymentStatus(returnedPaymentIntentId)
      .then((data) => {
        if (!isMounted) return;
        setPaymentIntentId(data.intent.paymentIntentId);
        mergeCheckout(data.checkout);
        setStep(getReturnedPaymentStep(data.intent));
        if (shouldLoadPromptPayQr(data.intent)) {
          void loadPromptPayQrCode(data.intent.paymentIntentId);
        }
      })
      .catch((error) => {
        console.error("Could not verify returned payment:", error);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [returnedPaymentIntentId]);

  // Age / Guardian states
  const [isAdult, setIsAdult] = useState<boolean | null>(null);
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [consentAlreadyGiven, setConsentAlreadyGiven] = useState(false);

  // Check if guardian consent was already submitted in a previous purchase
  useEffect(() => {
    studentApi.checkGuardianConsent()
      .then((data: { hasConsent: boolean }) => {
        if (data.hasConsent) setConsentAlreadyGiven(true);
      })
      .catch(() => {
        // Non-critical: if check fails, fall through to age-check as normal
      });
  }, []);

  const handleProceed = () => {
    if (consentAlreadyGiven) {
      // Skip age-check — consent on file, go straight to payment method
      setStep(method === "promptpay" ? "qr" : "card-form");
    } else {
      setStep("age-check");
    }
  };

  const handleAgeCheckSubmit = async () => {
    if (isAdult === null) return;

    setLoading(true);
    try {
      if (isAdult === false) {
        if (!guardianName.trim() || !guardianRelation.trim()) {
          toast.error(t("payment.errors.guardianRequired"));
          setLoading(false);
          return;
        }
        await studentApi.submitGuardianConsent(guardianName, guardianRelation);
      }
      setStep(method === "promptpay" ? "qr" : "card-form");
    } catch (error) {
      console.error("Error saving consent:", error);
      toast.error(t("payment.errors.consentFailed"));
    } finally {
      setLoading(false);
    }
  };

  const ensureOmiseToken = async () => {
    const config = await studentApi.getPaymentConfig();
    if (!config.configured || !config.publicKey) {
      throw new Error(t("payment.errors.omiseNotConfigured"));
    }

    await loadOmiseScript();
    if (!window.Omise) {
      throw new Error(t("payment.errors.loadOmiseScript"));
    }

    window.Omise.setPublicKey(config.publicKey);
    const [month, year] = cardExpiry.split("/");
    const fullYear = year?.length === 2 ? Number(`20${year}`) : Number(year);

    return new Promise<string>((resolve, reject) => {
      window.Omise?.createToken(
        "card",
        {
          name: cardName,
          number: cardNumber.replace(/\s/g, ""),
          expiration_month: Number(month),
          expiration_year: fullYear,
          security_code: cardCvv,
        },
        (statusCode, response) => {
          if (statusCode === 200 && response.id) {
            resolve(response.id);
            return;
          }
          reject(new Error(response.message || t("payment.errors.createCardTokenFailed")));
        },
      );
    });
  };

  const mergeCheckout = (next: CheckoutDetails | null) => {
    setCheckout((prev) => mergeCheckoutDetails(prev, next));
  };

  const verifyPaymentStatus = async (intentId: string) => {
    const status = await studentApi.getPaymentStatus(intentId);
    mergeCheckout(status.checkout);
    if (status.intent.status === "SUCCESS") {
      setStep("success");
      return;
    }
    if (status.intent.status === "FAILED") {
      throw new Error(
        `${t("payment.errors.paymentFailedPrefix")} ${status.checkout?.failureMessage || ""}`,
      );
    }
    toast.info(t("payment.errors.paymentPending"));
  };

  const stopQrPoll = () => {
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
  };

  const startQrAutoPoll = (intentId: string) => {
    stopQrPoll();
    qrPollRef.current = setInterval(async () => {
      try {
        const status = await studentApi.getPaymentStatus(intentId);
        mergeCheckout(status.checkout);
        if (status.intent.status === "SUCCESS") {
          stopQrPoll();
          setStep("success");
        } else if (status.intent.status === "FAILED") {
          stopQrPoll();
          toast.error(status.checkout?.failureMessage || t("payment.errors.paymentFailedPrefix"));
        }
      } catch {
        // ignore transient errors during polling
      }
    }, 5000);
  };

  const loadPromptPayQrCode = async (intentId: string) => {
    setQrLoading(true);
    try {
      const qr = await studentApi.getPaymentQrCode(intentId);
      setCheckout((prev) =>
        prev
          ? { ...prev, qrCodeDataUri: qr.dataUri }
          : {
              provider: "omise",
              chargeId: qr.chargeId,
              status: "pending",
              paid: false,
              authorizeUri: null,
              qrCodeUrl: null,
              qrCodeDataUri: qr.dataUri,
              failureMessage: null,
            },
      );
      // Start auto-polling after QR is loaded
      startQrAutoPoll(intentId);
    } finally {
      setQrLoading(false);
    }
  };

  // Cleanup poll on unmount
  useEffect(() => () => { stopQrPoll(); }, []);

  const handleConfirmPayment = async () => {
    stopQrPoll(); // stop auto-poll while manually checking
    setLoading(true);
    try {
      if (method === "promptpay" && paymentIntentId) {
        await verifyPaymentStatus(paymentIntentId);
        return;
      }

      const enrollment = cycleId
        ? await studentApi.prepareClassBookCycleAccess(classId, cycleId)
        : referralToken
        ? await studentApi.enrollByReferral(referralToken)
        : await studentApi.enrollClass(classId);
      if (enrollment.status === "ACTIVE") {
        setStep("success");
        return;
      }

      const omiseToken =
        method === "card" ? await ensureOmiseToken() : undefined;
      const payment = await studentApi.createPaymentIntent({
        enrollmentId: enrollment.enrollmentId,
        enrollmentPackageId: enrollment.enrollmentPackageId,
        amountSatang: enrollment.amountSatang || cls.priceSatang,
        method,
        omiseToken,
        // Include classId/cycleId so 3DS card redirect can resume payment correctly
        returnUri: (() => {
          const base = window.location.href.split("?")[0];
          const rp = new URLSearchParams();
          if (classId) rp.set("classId", classId);
          if (cycleId) rp.set("cycleId", cycleId);
          if (referralToken) rp.set("referralToken", referralToken);
          return `${base}?${rp.toString()}`;
        })(),
      });

      setPaymentIntentId(payment.intent.paymentIntentId);
      mergeCheckout(payment.checkout);

      if (payment.intent.status === "SUCCESS" || payment.checkout?.paid) {
        setStep("success");
        return;
      }

      if (payment.checkout?.authorizeUri && method === "card") {
        window.location.href = payment.checkout.authorizeUri;
        return;
      }

      if (method === "promptpay") {
        setStep("qr");
        await loadPromptPayQrCode(payment.intent.paymentIntentId);
        return;
      }

      throw new Error(
        payment.checkout?.failureMessage || t("payment.errors.paymentIncomplete"),
      );
    } catch (err) {
      console.error("Payment/Enrollment failed:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : t("payment.errors.enrollmentFailed"),
      );
    } finally {
      setLoading(false);
      // Resume auto-poll if still on QR step and intent exists
      if (step === "qr" && paymentIntentId && !qrPollRef.current) {
        startQrAutoPoll(paymentIntentId);
      }
    }
  };

  // ── Success ──
  if (step === "success") {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
          textAlign: "center",
          background: "var(--surface-bg)",
        }}
      >
        <div
          className="animate-bounce-in"
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            boxShadow: "0 8px 30px rgba(6,199,85,0.2)",
          }}
        >
          <CheckCircle2 size={44} style={{ color: "#16a34a" }} />
        </div>
        <h1
          className="animate-slide-up"
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          {t("payment.success.title")}
        </h1>
        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            marginBottom: 8,
          }}
        >
          {t("payment.success.description")}
        </p>

        <div
          className="glass-card"
          style={{
            width: "100%",
            maxWidth: 320,
            margin: "24px auto",
            textAlign: "left",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: t("payment.success.classLabel"), value: cls.name },
              { label: t("payment.success.tutorLabel"), value: cls.tutor },
              { label: t("payment.success.amountLabel"), value: `THB ${cls.price.toLocaleString()}` },
              {
                label: t("payment.success.methodLabel"),
                value:
                  method === "promptpay" ? "PromptPay" : t("payment.success.cardMethod"),
              },
              { label: t("payment.success.statusLabel"), value: `✅ ${t("payment.success.confirmedStatus")}` },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: "0.875rem",
                }}
              >
                <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    textAlign: "right",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--text-tertiary)",
            marginBottom: 28,
            lineHeight: 1.65,
          }}
        >
          {t("payment.success.lineNoticeFirst")}
          <br />
          {t("payment.success.lineNoticeSecond")}
        </p>
        <Link
          href="/dashboard"
          id="btn-go-dashboard"
          className="btn btn-primary btn-lg btn-full"
          style={{ maxWidth: 320, borderRadius: 18 }}
        >
          {t("payment.success.dashboardCta")}
        </Link>
      </div>
    );
  }

  // ── Age Check ──
  if (step === "age-check") {
    return (
      <div className="page-shell">
        <div
          className="top-bar"
          style={{
            background: "var(--surface-card)",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            onClick={() => setStep("select")}
            style={{
              background: "var(--neutral-100)",
              border: "none",
              borderRadius: 12,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <h1
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              flex: 1,
            }}
          >
            {t("payment.ageCheck.title")}
          </h1>
        </div>

        <div
          style={{
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Shield size={20} style={{ color: "rgb(16, 185, 129)" }} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "1rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  marginBottom: 2,
                }}
              >
                {t("payment.ageCheck.pdpaTitle")}
              </h2>
              <p
                style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
              >
                {t("payment.ageCheck.pdpaSubtitle")}
              </p>
            </div>
          </div>

          <div
            className="glass-card"
            style={{
              padding: "20px",
              border: "1px solid var(--surface-border)",
            }}
          >
            <p
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 16,
              }}
            >
              {t("payment.ageCheck.adultQuestion")}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <button
                onClick={() => setIsAdult(true)}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border:
                    isAdult === true
                      ? "2px solid var(--brand-500)"
                      : "1px solid var(--surface-border)",
                  background:
                    isAdult === true
                      ? "var(--brand-50)"
                      : "var(--surface-card)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color:
                    isAdult === true
                      ? "var(--brand-700)"
                      : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {t("payment.ageCheck.adultYes")}
              </button>
              <button
                onClick={() => setIsAdult(false)}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border:
                    isAdult === false
                      ? "2px solid var(--brand-500)"
                      : "1px solid var(--surface-border)",
                  background:
                    isAdult === false
                      ? "var(--brand-50)"
                      : "var(--surface-card)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color:
                    isAdult === false
                      ? "var(--brand-700)"
                      : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {t("payment.ageCheck.adultNo")}
              </button>
            </div>

            {isAdult === false && (
              <div
                className="animate-slide-up"
                style={{
                  marginTop: "24px",
                  paddingTop: "20px",
                  borderTop: "1px solid var(--surface-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    background: "var(--accent-amber-light)",
                    padding: "12px",
                    borderRadius: "10px",
                    marginBottom: 4,
                    border: "1px solid #fde68a",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "#92400e",
                      lineHeight: 1.5,
                    }}
                  >
                    {t("payment.ageCheck.guardianNotice")}
                    {t("payment.ageCheck.guardianInstruction")}
                  </p>
                </div>
                <div>
                  <label className="input-label">{t("payment.ageCheck.guardianNameLabel")}</label>
                  <input
                    type="text"
                    placeholder={t("payment.ageCheck.guardianNamePlaceholder")}
                    className="input-field"
                    style={{ borderRadius: 12 }}
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">{t("payment.ageCheck.guardianRelationLabel")}</label>
                  <input
                    type="text"
                    placeholder={t("payment.ageCheck.guardianRelationPlaceholder")}
                    className="input-field"
                    style={{ borderRadius: 12 }}
                    value={guardianRelation}
                    onChange={(e) => setGuardianRelation(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            id="btn-submit-age-check"
            className="btn btn-primary btn-full btn-lg"
            onClick={handleAgeCheckSubmit}
            disabled={
              loading ||
              isAdult === null ||
              (isAdult === false &&
                (!guardianName.trim() || !guardianRelation.trim()))
            }
            style={{ borderRadius: 18, marginTop: 8 }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="animate-spin"
                  style={{
                    width: 18,
                    height: 18,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                {t("payment.ageCheck.saving")}
              </span>
            ) : (
              t("payment.ageCheck.continuePayment")
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── QR ──
  if (step === "qr") {
    return (
      <div className="page-shell">
        <div
          className="top-bar"
          style={{
            background: "var(--surface-card)",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            onClick={() => setStep("select")}
            style={{
              background: "var(--neutral-100)",
              border: "none",
              borderRadius: 12,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <h1
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              flex: 1,
            }}
          >
            {t("payment.promptpay.title")}
          </h1>
        </div>

        <div
          style={{
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            className="glass-card"
            style={{ padding: "18px 20px", width: "100%", textAlign: "center" }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-tertiary)",
                marginBottom: 4,
              }}
            >
              {t("payment.promptpay.amountDue")}
            </div>
            <div
              style={{ fontSize: "2rem", fontWeight: 800 }}
              className="gradient-text"
            >
              THB {cls.price.toLocaleString()}
            </div>
          </div>

          <div
            className="qr-container"
            style={{ width: 200, height: 270, borderRadius: 20 }}
          >
            {checkout?.qrCodeDataUri ? (
              <Image
                src={checkout.qrCodeDataUri}
                alt="PromptPay QR"
                width={180}
                height={180}
                unoptimized
                style={{ objectFit: "contain", borderRadius: 8 }}
              />
            ) : (
              <div
                style={{
                  width: 180,
                  height: 180,
                  background: "var(--neutral-100)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: "0.75rem",
                  lineHeight: 1.5,
                }}
              >
                {qrLoading
                  ? "Loading QR from Omise..."
                  : "Create PromptPay QR to continue"}
              </div>
            )}
          </div>

          <div
            className="glass-card"
            style={{ padding: "16px", width: "100%" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                t("payment.promptpay.step1"),
                t("payment.promptpay.step2"),
                t("payment.promptpay.step3"),
                t("payment.promptpay.step4"),
              ].map((s, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 10, alignItems: "center" }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "var(--brand-500)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "var(--accent-amber-light)",
              borderRadius: 14,
              padding: "12px 14px",
              width: "100%",
              border: "1px solid #fde68a",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Clock size={16} style={{ color: "#92400e", flexShrink: 0 }} />
            <p
              style={{
                fontSize: "0.8125rem",
                color: "#92400e",
                lineHeight: 1.5,
              }}
            >
              {t("payment.promptpay.expiryPrefix")} <strong>{t("payment.promptpay.expiryTime")}</strong>
            </p>
          </div>

          <button
            id="btn-confirm-promptpay"
            className="btn btn-primary btn-full btn-lg"
            onClick={handleConfirmPayment}
            disabled={loading}
            style={{ borderRadius: 18 }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="animate-spin"
                  style={{
                    width: 18,
                    height: 18,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                {t("payment.promptpay.checking")}
              </span>
            ) : paymentIntentId ? (
              t("payment.promptpay.checkStatus")
            ) : (
              t("payment.promptpay.createQr")
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Card form ──
  if (step === "card-form") {
    return (
      <div className="page-shell">
        <div
          className="top-bar"
          style={{
            background: "var(--surface-card)",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            onClick={() => setStep("select")}
            style={{
              background: "var(--neutral-100)",
              border: "none",
              borderRadius: 12,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <h1
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              flex: 1,
            }}
          >
            {t("payment.card.title")}
          </h1>
        </div>

        <div
          style={{
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            className="glass-card"
            style={{
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}
            >
              {t("payment.card.amount")}
            </span>
            <span
              style={{ fontSize: "1.25rem", fontWeight: 800 }}
              className="gradient-text"
            >
              THB {cls.price.toLocaleString()}
            </span>
          </div>

          <div>
            <label htmlFor="input-card-number" className="input-label">
              {t("payment.card.numberLabel")}
            </label>
            <input
              id="input-card-number"
              type="tel"
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              className="input-field"
              style={{ borderRadius: 14 }}
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              autoComplete="cc-number"
            />
          </div>
          <div>
            <label htmlFor="input-card-name" className="input-label">
              {t("payment.card.nameLabel")}
            </label>
            <input
              id="input-card-name"
              type="text"
              placeholder="SOMCHAI JAIDEE"
              className="input-field"
              style={{ borderRadius: 14 }}
              value={cardName}
              onChange={(e) => setCardName(e.target.value.toUpperCase())}
              autoComplete="cc-name"
            />
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label htmlFor="input-card-expiry" className="input-label">
                {t("payment.card.expiryLabel")}
              </label>
              <input
                id="input-card-expiry"
                type="tel"
                inputMode="numeric"
                placeholder="MM/YY"
                className="input-field"
                style={{ borderRadius: 14 }}
                value={cardExpiry}
                onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
                autoComplete="cc-exp"
                maxLength={5}
              />
            </div>
            <div>
              <label htmlFor="input-card-cvv" className="input-label">
                CVV
              </label>
              <input
                id="input-card-cvv"
                type="tel"
                inputMode="numeric"
                placeholder="123"
                className="input-field"
                style={{ borderRadius: 14 }}
                value={cardCvv}
                onChange={(e) =>
                  setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                autoComplete="cc-csc"
                maxLength={4}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "12px 14px",
              borderRadius: 14,
            }}
            className="glass-card"
          >
            <Shield
              size={16}
              style={{
                color: "var(--text-tertiary)",
                flexShrink: 0,
                marginTop: 1,
              }}
            />
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                lineHeight: 1.65,
              }}
            >
              {t("payment.card.securityPrefix")} <strong>{t("payment.card.securityProvider")}</strong>{" "}
              {t("payment.card.securitySuffix")}
            </p>
          </div>

          <button
            id="btn-confirm-card"
            className="btn btn-primary btn-full btn-lg"
            onClick={handleConfirmPayment}
            disabled={
              loading || !cardNumber || !cardName || !cardExpiry || !cardCvv
            }
            style={{ borderRadius: 18, marginTop: 4 }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="animate-spin"
                  style={{
                    width: 18,
                    height: 18,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                {t("payment.card.processing")}
              </span>
            ) : (
              `${t("payment.card.payPrefix")} THB ${cls.price.toLocaleString()}`
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Method selection ──
  return (
    <div className="page-shell">
      <div
        className="top-bar"
        style={{
          background: "var(--surface-card)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Link
          href={`/classes/${classId}`}
          style={{
            background: "var(--neutral-100)",
            border: "none",
            borderRadius: 12,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={18} />
        </Link>
        <h1
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            flex: 1,
          }}
        >
          {t("payment.select.title")}
        </h1>
      </div>

      <div
        style={{
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Order summary */}
        <div className="glass-card" style={{ overflow: "hidden" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #06c755 0%, #037d36 100%)",
              padding: "18px 20px",
              borderRadius: "20px 20px 0 0",
            }}
          >
            <p
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: "0.6875rem",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            >
              {t("payment.select.orderSummary")}
            </p>
            <h2
              style={{
                color: "#fff",
                fontSize: "1rem",
                fontWeight: 700,
                lineHeight: 1.3,
              }}
            >
              {cls.name}
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: "0.8125rem",
                marginTop: 2,
              }}
            >
              {cls.tutor} / {cls.cefr}
            </p>
          </div>
          <div style={{ padding: "16px 20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span
                style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}
              >
                {t("payment.select.tuition")}
              </span>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                THB {cls.price.toLocaleString()}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span
                style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}
              >
                {t("payment.select.fee")}
              </span>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                THB 0
              </span>
            </div>
            <div className="divider" />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {t("payment.select.total")}
              </span>
              <span
                style={{ fontSize: "1.25rem", fontWeight: 800 }}
                className="gradient-text"
              >
                THB {cls.price.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div>
          <h2
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            {t("payment.select.selectMethod")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                id: "pm-promptpay",
                method: "promptpay" as const,
                Icon: QrCode,
                label: "PromptPay",
                sub: t("payment.select.promptpaySub"),
                badge: t("payment.select.recommendedBadge"),
              },
              {
                id: "pm-card",
                method: "card" as const,
                Icon: CreditCard,
                label: t("payment.select.cardLabel"),
                sub: "Visa, Mastercard, JCB",
                badge: null,
              },
            ].map((opt) => (
              <button
                key={opt.id}
                id={opt.id}
                onClick={() => setMethod(opt.method)}
                className="glass-card"
                style={{
                  width: "100%",
                  cursor: "pointer",
                  border:
                    method === opt.method
                      ? "2px solid var(--brand-500)"
                      : "1px solid var(--surface-border)",
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px",
                  background:
                    method === opt.method
                      ? "var(--brand-50)"
                      : "var(--surface-card)",
                  boxShadow:
                    method === opt.method
                      ? "0 0 0 3px rgba(6,199,85,0.1)"
                      : "var(--shadow-sm)",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background:
                      method === opt.method
                        ? "var(--brand-100)"
                        : "var(--neutral-100)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "background 0.2s ease",
                  }}
                >
                  <opt.Icon
                    size={20}
                    style={{
                      color:
                        method === opt.method
                          ? "var(--brand-600)"
                          : "var(--text-tertiary)",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {opt.label}
                    </span>
                    {opt.badge && (
                      <span
                        style={{
                          background: "var(--brand-100)",
                          color: "var(--brand-700)",
                          fontSize: "0.625rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 8,
                        }}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {opt.sub}
                  </div>
                </div>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `2px solid ${method === opt.method ? "var(--brand-500)" : "var(--neutral-300)"}`,
                    background:
                      method === opt.method
                        ? "var(--brand-500)"
                        : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.2s ease",
                  }}
                >
                  {method === opt.method && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Secure badges */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "8px 0",
          }}
        >
          {[t("payment.select.secureBadgeSsl"), t("payment.select.secureBadgeOmise"), t("payment.select.secureBadgePci")].map(
            (badge) => (
              <span
                key={badge}
                style={{
                  fontSize: "0.625rem",
                  color: "var(--text-tertiary)",
                  fontWeight: 500,
                }}
              >
                {badge}
              </span>
            ),
          )}
        </div>

        <button
          id="btn-proceed-payment"
          className="btn btn-primary btn-full btn-lg shine-effect"
          onClick={handleProceed}
          style={{ borderRadius: 18 }}
        >
          {t("payment.select.proceed")} <ChevronRight size={18} />
        </button>

        <p
          style={{
            textAlign: "center",
            fontSize: "0.6875rem",
            color: "var(--text-tertiary)",
            lineHeight: 1.65,
          }}
        >          {t("payment.select.noExtraFee")}
          <br />
          {t("payment.select.contactPrefix")}{" "}
          <a
            href="https://lin.ee/zqTz6feg"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--brand-600)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("payment.select.contactLine")}
          </a>
        </p>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="animate-spin"
            style={{
              width: 32,
              height: 32,
              border: "3px solid var(--neutral-200)",
              borderTopColor: "var(--brand-500)",
              borderRadius: "50%",
            }}
          />
        </div>
      }
    >
      <PaymentFlow />
    </Suspense>
  );
}
