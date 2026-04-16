"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type PaymentMethod = "promptpay" | "card";
type Step = "select" | "qr" | "card-form" | "success";

function PaymentFlow() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId") ?? "cls-001";

  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [step, setStep] = useState<Step>("select");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [loading, setLoading] = useState(false);

  // Mock class info
  const cls = {
    id: classId,
    name: "Origins 2 — กลุ่มวันเสาร์",
    price: 2800,
    tutor: "อ.นภา สุขใส",
    cefr: "A1",
  };

  const handleProceed = () => {
    if (method === "promptpay") {
      setStep("qr");
    } else {
      setStep("card-form");
    }
  };

  const handleConfirmPayment = async () => {
    setLoading(true);
    // Simulate API call to Omise / backend
    await new Promise((r) => setTimeout(r, 2000));
    setLoading(false);
    setStep("success");
  };

  const formatCardNumber = (val: string) =>
    val
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();

  const formatExpiry = (val: string) =>
    val
      .replace(/\D/g, "")
      .slice(0, 4)
      .replace(/(.{2})/, "$1/");

  // ── Success screen ─────────────────────────────────────────────────
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
          background: "linear-gradient(160deg, #f0fdf6 0%, #fff 60%)",
        }}
      >
        <div
          className="animate-bounce-in"
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "var(--brand-100)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            fontSize: "2.5rem",
          }}
        >
          ✅
        </div>

        <h1
          className="animate-slide-up"
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--neutral-900)",
            marginBottom: 10,
          }}
        >
          ชำระเงินสำเร็จ!
        </h1>
        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--neutral-500)",
            lineHeight: 1.7,
            marginBottom: 8,
          }}
        >
          การลงทะเบียนของคุณได้รับการยืนยันแล้ว
        </p>

        <div
          className="card card-padded"
          style={{ width: "100%", maxWidth: 320, margin: "24px auto", textAlign: "left" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "คลาส", value: cls.name },
              { label: "ติวเตอร์", value: cls.tutor },
              { label: "ยอดชำระ", value: `฿${cls.price.toLocaleString()}` },
              {
                label: "วิธีชำระ",
                value: method === "promptpay" ? "PromptPay" : "บัตรเครดิต/เดบิต",
              },
              { label: "สถานะ", value: "✅ ยืนยันแล้ว" },
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
                <span style={{ color: "var(--neutral-500)" }}>{label}</span>
                <span style={{ fontWeight: 600, color: "var(--neutral-900)", textAlign: "right" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--neutral-400)",
            marginBottom: 28,
            lineHeight: 1.65,
          }}
        >
          คุณจะได้รับการแจ้งเตือนผ่าน LINE<br />
          เมื่อการลงทะเบียนเปิดใช้งาน
        </p>

        <Link
          href="/dashboard"
          id="btn-go-dashboard"
          className="btn btn-primary btn-lg btn-full"
          style={{ maxWidth: 320 }}
        >
          ไปหน้าหลัก
        </Link>
      </div>
    );
  }

  // ── PromptPay QR ───────────────────────────────────────────────────
  if (step === "qr") {
    return (
      <div className="page-shell">
        <div className="top-bar">
          <button
            onClick={() => setStep("select")}
            style={{ background: "var(--neutral-100)", border: "none", borderRadius: "var(--radius-md)", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--neutral-700)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--neutral-900)", flex: 1 }}>
            สแกน PromptPay
          </h1>
        </div>

        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div
            style={{
              background: "var(--brand-50)",
              borderRadius: "var(--radius-xl)",
              padding: "16px 20px",
              width: "100%",
              textAlign: "center",
              border: "1.5px solid var(--brand-100)",
            }}
          >
            <div style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", marginBottom: 4 }}>ยอดที่ต้องชำระ</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--brand-700)" }}>
              ฿{cls.price.toLocaleString()}
            </div>
          </div>

          {/* QR Placeholder */}
          <div className="qr-container" style={{ width: 220, height: 220 }}>
            <div
              style={{
                width: 180,
                height: 180,
                background: "repeating-linear-gradient(0deg, #000 0px, #000 6px, #fff 6px, #fff 12px), repeating-linear-gradient(90deg, #000 0px, #000 6px, #fff 6px, #fff 12px)",
                backgroundBlendMode: "difference",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ background: "#fff", padding: "6px 8px", borderRadius: 4, fontSize: "0.625rem", fontWeight: 700, textAlign: "center", zIndex: 1 }}>
                QR Code<br />จะแสดงหลัง<br />เชื่อม Omise
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: "var(--radius-lg)",
              padding: "16px",
              width: "100%",
              border: "1px solid var(--neutral-200)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "เปิดแอป Mobile Banking ของคุณ",
                "เลือก สแกน PromptPay",
                "สแกน QR code ด้านบน",
                "ยืนยันยอดและชำระเงิน",
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span style={{ fontSize: "0.875rem", color: "var(--neutral-700)" }}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--accent-amber-light)", borderRadius: "var(--radius-md)", padding: "12px 14px", width: "100%", border: "1px solid #fde68a" }}>
            <p style={{ fontSize: "0.8125rem", color: "#92400e", lineHeight: 1.65 }}>
              ⏱️ QR Code หมดอายุใน <strong>15 นาที</strong> หากหมดให้กด &quot;ขอ QR ใหม่&quot;
            </p>
          </div>

          <button
            id="btn-confirm-promptpay"
            className="btn btn-primary btn-full btn-lg"
            onClick={handleConfirmPayment}
            disabled={loading}
            style={{ borderRadius: "var(--radius-full)" }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="animate-spin" style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />
                กำลังตรวจสอบ...
              </span>
            ) : (
              "ชำระแล้ว — ยืนยัน"
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Card form ──────────────────────────────────────────────────────
  if (step === "card-form") {
    return (
      <div className="page-shell">
        <div className="top-bar">
          <button
            onClick={() => setStep("select")}
            style={{ background: "var(--neutral-100)", border: "none", borderRadius: "var(--radius-md)", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--neutral-700)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--neutral-900)", flex: 1 }}>
            ชำระด้วยบัตร
          </h1>
        </div>

        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Amount reminder */}
          <div
            style={{
              background: "var(--brand-50)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1.5px solid var(--brand-100)",
            }}
          >
            <span style={{ fontSize: "0.875rem", color: "var(--neutral-600)" }}>ยอดชำระ</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--brand-700)" }}>
              ฿{cls.price.toLocaleString()}
            </span>
          </div>

          {/* Card number */}
          <div>
            <label htmlFor="input-card-number" className="input-label">หมายเลขบัตร</label>
            <input
              id="input-card-number"
              type="tel"
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              className="input-field"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              autoComplete="cc-number"
            />
          </div>

          {/* Name on card */}
          <div>
            <label htmlFor="input-card-name" className="input-label">ชื่อผู้ถือบัตร (ภาษาอังกฤษ)</label>
            <input
              id="input-card-name"
              type="text"
              placeholder="SOMCHAI JAIDEE"
              className="input-field"
              value={cardName}
              onChange={(e) => setCardName(e.target.value.toUpperCase())}
              autoComplete="cc-name"
            />
          </div>

          {/* Expiry + CVV */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="input-card-expiry" className="input-label">วันหมดอายุ</label>
              <input
                id="input-card-expiry"
                type="tel"
                inputMode="numeric"
                placeholder="MM/YY"
                className="input-field"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                autoComplete="cc-exp"
                maxLength={5}
              />
            </div>
            <div>
              <label htmlFor="input-card-cvv" className="input-label">CVV</label>
              <input
                id="input-card-cvv"
                type="tel"
                inputMode="numeric"
                placeholder="123"
                className="input-field"
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                autoComplete="cc-csc"
                maxLength={4}
              />
            </div>
          </div>

          {/* Security notice */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "12px 14px",
              background: "var(--neutral-50)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--neutral-200)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <p style={{ fontSize: "0.75rem", color: "var(--neutral-500)", lineHeight: 1.65 }}>
              การชำระเงินปลอดภัยโดย <strong>Omise</strong> ข้อมูลบัตรของคุณถูกเข้ารหัสและไม่ถูกเก็บไว้ในระบบของเรา
            </p>
          </div>

          <button
            id="btn-confirm-card"
            className="btn btn-primary btn-full btn-lg"
            onClick={handleConfirmPayment}
            disabled={loading || !cardNumber || !cardName || !cardExpiry || !cardCvv}
            style={{ borderRadius: "var(--radius-full)", marginTop: 4 }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="animate-spin" style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />
                กำลังดำเนินการ...
              </span>
            ) : (
              `ชำระ ฿${cls.price.toLocaleString()}`
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Method selection (default step) ───────────────────────────────
  return (
    <div className="page-shell">
      <div className="top-bar">
        <Link
          href={`/classes/${classId}`}
          style={{ background: "var(--neutral-100)", border: "none", borderRadius: "var(--radius-md)", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--neutral-700)", textDecoration: "none", flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--neutral-900)", flex: 1 }}>
          ชำระเงิน
        </h1>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Order summary */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #06c755 0%, #047d36 100%)",
              padding: "16px 20px",
            }}
          >
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", marginBottom: 4 }}>
              สรุปคำสั่งซื้อ
            </p>
            <h2 style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, lineHeight: 1.3 }}>
              {cls.name}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8125rem", marginTop: 2 }}>
              {cls.tutor} · {cls.cefr}
            </p>
          </div>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: "0.875rem", color: "var(--neutral-500)" }}>ค่าเรียน</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-900)" }}>
                ฿{cls.price.toLocaleString()}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: "0.875rem", color: "var(--neutral-500)" }}>ค่าธรรมเนียม</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-900)" }}>
                ฿0
              </span>
            </div>
            <div className="divider" />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--neutral-900)" }}>รวมทั้งหมด</span>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--brand-700)" }}>
                ฿{cls.price.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div>
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--neutral-900)", marginBottom: 12 }}>
            เลือกวิธีชำระเงิน
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                id: "pm-promptpay",
                method: "promptpay" as const,
                icon: "🏦",
                label: "PromptPay",
                sub: "สแกน QR ผ่านแอปธนาคาร — แนะนำสำหรับไทย",
                badge: "แนะนำ",
              },
              {
                id: "pm-card",
                method: "card" as const,
                icon: "💳",
                label: "บัตรเครดิต / เดบิต",
                sub: "Visa, Mastercard, JCB",
                badge: null,
              },
            ].map((opt) => (
              <button
                key={opt.id}
                id={opt.id}
                onClick={() => setMethod(opt.method)}
                className={`payment-method-card${method === opt.method ? " selected" : ""}`}
                style={{ width: "100%", cursor: "pointer", border: "none", fontFamily: "inherit", textAlign: "left" }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--radius-md)",
                    background: method === opt.method ? "var(--brand-100)" : "var(--neutral-100)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.25rem",
                    flexShrink: 0,
                    transition: "background var(--duration-fast)",
                  }}
                >
                  {opt.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--neutral-900)" }}>
                      {opt.label}
                    </span>
                    {opt.badge && (
                      <span className="badge badge-success" style={{ fontSize: "0.6875rem", padding: "2px 8px" }}>
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", marginTop: 2 }}>
                    {opt.sub}
                  </div>
                </div>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `2px solid ${method === opt.method ? "var(--brand-500)" : "var(--neutral-300)"}`,
                    background: method === opt.method ? "var(--brand-500)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all var(--duration-fast)",
                  }}
                >
                  {method === opt.method && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
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
            padding: "12px 0",
          }}
        >
          {["🔒 SSL ปลอดภัย", "✅ Omise Certified", "🏛️ PCI DSS"].map((badge) => (
            <span key={badge} style={{ fontSize: "0.6875rem", color: "var(--neutral-400)", fontWeight: 500 }}>
              {badge}
            </span>
          ))}
        </div>

        {/* Proceed button */}
        <button
          id="btn-proceed-payment"
          className="btn btn-primary btn-full btn-lg"
          onClick={handleProceed}
          style={{ borderRadius: "var(--radius-full)" }}
        >
          ดำเนินการชำระเงิน
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--neutral-400)", lineHeight: 1.65 }}>
          ชำระเงินครั้งเดียว ไม่มีค่าบริการเพิ่มเติม<br />
          สอบถามเพิ่มเติมติดต่อทีมงานผ่าน LINE
        </p>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    }>
      <PaymentFlow />
    </Suspense>
  );
}
