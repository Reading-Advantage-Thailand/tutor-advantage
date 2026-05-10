"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, Shield, CheckCircle2, CreditCard, QrCode, Clock, ChevronRight } from "lucide-react";
import { studentApi } from "@/lib/api";

type PaymentMethod = "promptpay" | "card";
type Step = "select" | "age-check" | "qr" | "card-form" | "success";

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

  const cls = { id: classId, name: "Origins 2 — กลุ่มวันเสาร์", price: 2800, tutor: "อ.นภา สุขใส", cefr: "A1" };

  // Age / Guardian states
  const [isAdult, setIsAdult] = useState<boolean | null>(null);
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");

  const handleProceed = () => { 
    setStep("age-check");
  };

  const handleAgeCheckSubmit = async () => {
    if (isAdult === null) return;
    
    setLoading(true);
    try {
      if (isAdult === false) {
        if (!guardianName.trim() || !guardianRelation.trim()) {
          alert("กรุณากรอกข้อมูลให้ครบถ้วน");
          setLoading(false);
          return;
        }
        await studentApi.submitGuardianConsent(guardianName, guardianRelation);
      }
      setStep(method === "promptpay" ? "qr" : "card-form");
    } catch (error) {
      console.error("Error saving consent:", error);
      alert("เกิดข้อผิดพลาดในการยืนยันตัวตน");
    } finally {
      setLoading(false);
    }
  };
  
  const handleConfirmPayment = async () => { 
    setLoading(true); 
    try {
      // 1. Call Enrollment API
      await studentApi.enrollClass(classId);
      
      // 2. Simulate payment processing delay
      await new Promise((r) => setTimeout(r, 1500)); 
      
      setStep("success"); 
    } catch (err: any) {
      console.error("Payment/Enrollment failed:", err);
      alert(err.message || "การลงทะเบียนล้มเหลว กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false); 
    }
  };

  const formatCardNumber = (val: string) => val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (val: string) => val.replace(/\D/g, "").slice(0, 4).replace(/(.{2})/, "$1/");

  // ── Success ──
  if (step === "success") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", textAlign: "center", background: "var(--surface-bg)" }}>
        <div className="animate-bounce-in" style={{ width: 96, height: 96, borderRadius: "50%", background: "linear-gradient(135deg, #dcfce7, #bbf7d0)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "0 8px 30px rgba(6,199,85,0.2)" }}>
          <CheckCircle2 size={44} style={{ color: "#16a34a" }} />
        </div>
        <h1 className="animate-slide-up" style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>ชำระเงินสำเร็จ!</h1>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 8 }}>การลงทะเบียนของคุณได้รับการยืนยันแล้ว</p>

        <div className="glass-card" style={{ width: "100%", maxWidth: 320, margin: "24px auto", textAlign: "left", padding: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "คลาส", value: cls.name },
              { label: "ติวเตอร์", value: cls.tutor },
              { label: "ยอดชำระ", value: `฿${cls.price.toLocaleString()}` },
              { label: "วิธีชำระ", value: method === "promptpay" ? "PromptPay" : "บัตรเครดิต/เดบิต" },
              { label: "สถานะ", value: "✅ ยืนยันแล้ว" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.875rem" }}>
                <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", marginBottom: 28, lineHeight: 1.65 }}>
          คุณจะได้รับการแจ้งเตือนผ่าน LINE<br />เมื่อการลงทะเบียนเปิดใช้งาน
        </p>
        <Link href="/dashboard" id="btn-go-dashboard" className="btn btn-primary btn-lg btn-full" style={{ maxWidth: 320, borderRadius: 18 }}>ไปหน้าหลัก</Link>
      </div>
    );
  }

  // ── Age Check ──
  if (step === "age-check") {
    return (
      <div className="page-shell">
        <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)" }}>
          <button onClick={() => setStep("select")} style={{ background: "var(--neutral-100)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
            <ChevronLeft size={18} />
          </button>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>ยืนยันข้อมูลผู้เรียน</h1>
        </div>

        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Shield size={20} style={{ color: "rgb(16, 185, 129)" }} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>ตรวจสอบสิทธิ์ตามกฎหมาย (PDPA)</h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>เพื่อความปลอดภัยในการชำระเงิน</p>
            </div>
          </div>

          <div className="glass-card" style={{ padding: "20px", border: "1px solid var(--surface-border)" }}>
            <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
              ขณะนี้คุณมีอายุครบ 18 ปีบริบูรณ์แล้วใช่หรือไม่?
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                onClick={() => setIsAdult(true)}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: isAdult === true ? "2px solid var(--brand-500)" : "1px solid var(--surface-border)",
                  background: isAdult === true ? "var(--brand-50)" : "var(--surface-card)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: isAdult === true ? "var(--brand-700)" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                ใช่ เกิน 18 ปีแล้ว
              </button>
              <button
                onClick={() => setIsAdult(false)}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: isAdult === false ? "2px solid var(--brand-500)" : "1px solid var(--surface-border)",
                  background: isAdult === false ? "var(--brand-50)" : "var(--surface-card)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: isAdult === false ? "var(--brand-700)" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                ยังไม่ถึง 18 ปี
              </button>
            </div>

            {isAdult === false && (
              <div className="animate-slide-up" style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--surface-border)", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "var(--accent-amber-light)", padding: "12px", borderRadius: "10px", marginBottom: 4, border: "1px solid #fde68a" }}>
                  <p style={{ fontSize: "0.75rem", color: "#92400e", lineHeight: 1.5 }}>
                    คุณจำเป็นต้องให้ผู้ปกครองรับทราบ กรุณากรอกข้อมูลผู้ปกครองเพื่อใช้ประกอบความยินยอมทางกฎหมาย
                  </p>
                </div>
                <div>
                  <label className="input-label">ชื่อ-นามสกุล ผู้ปกครอง</label>
                  <input 
                    type="text" 
                    placeholder="เช่น สมชาย รักการเรียน" 
                    className="input-field" 
                    style={{ borderRadius: 12 }}
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">ความสัมพันธ์</label>
                  <input 
                    type="text" 
                    placeholder="เช่น บิดา, มารดา, ลุง, ป้า" 
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
            disabled={loading || isAdult === null || (isAdult === false && (!guardianName.trim() || !guardianRelation.trim()))}
            style={{ borderRadius: 18, marginTop: 8 }}
          >
            {loading ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="animate-spin" style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />กำลังบันทึก...</span>) : "ดำเนินการชำระเงินต่อ"}
          </button>
        </div>
      </div>
    );
  }

  // ── QR ──
  if (step === "qr") {
    return (
      <div className="page-shell">
        <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)" }}>
          <button onClick={() => setStep("select")} style={{ background: "var(--neutral-100)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
            <ChevronLeft size={18} />
          </button>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>สแกน PromptPay</h1>
        </div>

        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div className="glass-card" style={{ padding: "18px 20px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: 4 }}>ยอดที่ต้องชำระ</div>
            <div style={{ fontSize: "2rem", fontWeight: 800 }} className="gradient-text">฿{cls.price.toLocaleString()}</div>
          </div>

          <div className="qr-container" style={{ width: 220, height: 220, borderRadius: 20 }}>
            <div style={{ width: 180, height: 180, background: "repeating-linear-gradient(0deg, #000 0px, #000 6px, #fff 6px, #fff 12px), repeating-linear-gradient(90deg, #000 0px, #000 6px, #fff 6px, #fff 12px)", backgroundBlendMode: "difference", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ background: "#fff", padding: "8px 10px", borderRadius: 6, fontSize: "0.625rem", fontWeight: 700, textAlign: "center", zIndex: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>QR Code<br />จะแสดงหลัง<br />เชื่อม Omise</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: "16px", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["เปิดแอป Mobile Banking ของคุณ", "เลือก สแกน PromptPay", "สแกน QR code ด้านบน", "ยืนยันยอดและชำระเงิน"].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--brand-500)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6875rem", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--accent-amber-light)", borderRadius: 14, padding: "12px 14px", width: "100%", border: "1px solid #fde68a", display: "flex", gap: 8, alignItems: "center" }}>
            <Clock size={16} style={{ color: "#92400e", flexShrink: 0 }} />
            <p style={{ fontSize: "0.8125rem", color: "#92400e", lineHeight: 1.5 }}>
              QR Code หมดอายุใน <strong>15 นาที</strong>
            </p>
          </div>

          <button id="btn-confirm-promptpay" className="btn btn-primary btn-full btn-lg" onClick={handleConfirmPayment} disabled={loading} style={{ borderRadius: 18 }}>
            {loading ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="animate-spin" style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />กำลังตรวจสอบ...</span>) : "ชำระแล้ว — ยืนยัน"}
          </button>
        </div>
      </div>
    );
  }

  // ── Card form ──
  if (step === "card-form") {
    return (
      <div className="page-shell">
        <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)" }}>
          <button onClick={() => setStep("select")} style={{ background: "var(--neutral-100)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
            <ChevronLeft size={18} />
          </button>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>ชำระด้วยบัตร</h1>
        </div>

        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="glass-card" style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>ยอดชำระ</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 800 }} className="gradient-text">฿{cls.price.toLocaleString()}</span>
          </div>

          <div>
            <label htmlFor="input-card-number" className="input-label">หมายเลขบัตร</label>
            <input id="input-card-number" type="tel" inputMode="numeric" placeholder="0000 0000 0000 0000" className="input-field" style={{ borderRadius: 14 }} value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} autoComplete="cc-number" />
          </div>
          <div>
            <label htmlFor="input-card-name" className="input-label">ชื่อผู้ถือบัตร (ภาษาอังกฤษ)</label>
            <input id="input-card-name" type="text" placeholder="SOMCHAI JAIDEE" className="input-field" style={{ borderRadius: 14 }} value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} autoComplete="cc-name" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="input-card-expiry" className="input-label">วันหมดอายุ</label>
              <input id="input-card-expiry" type="tel" inputMode="numeric" placeholder="MM/YY" className="input-field" style={{ borderRadius: 14 }} value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} autoComplete="cc-exp" maxLength={5} />
            </div>
            <div>
              <label htmlFor="input-card-cvv" className="input-label">CVV</label>
              <input id="input-card-cvv" type="tel" inputMode="numeric" placeholder="123" className="input-field" style={{ borderRadius: 14 }} value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} autoComplete="cc-csc" maxLength={4} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14 }} className="glass-card">
            <Shield size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
              การชำระเงินปลอดภัยโดย <strong>Omise</strong> ข้อมูลบัตรของคุณถูกเข้ารหัสและไม่ถูกเก็บไว้ในระบบของเรา
            </p>
          </div>

          <button id="btn-confirm-card" className="btn btn-primary btn-full btn-lg" onClick={handleConfirmPayment} disabled={loading || !cardNumber || !cardName || !cardExpiry || !cardCvv} style={{ borderRadius: 18, marginTop: 4 }}>
            {loading ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="animate-spin" style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />กำลังดำเนินการ...</span>) : `ชำระ ฿${cls.price.toLocaleString()}`}
          </button>
        </div>
      </div>
    );
  }

  // ── Method selection ──
  return (
    <div className="page-shell">
      <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)" }}>
        <Link href={`/classes/${classId}`} style={{ background: "var(--neutral-100)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", textDecoration: "none", flexShrink: 0 }}>
          <ChevronLeft size={18} />
        </Link>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>ชำระเงิน</h1>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Order summary */}
        <div className="glass-card" style={{ overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg, #06c755 0%, #037d36 100%)", padding: "18px 20px", borderRadius: "20px 20px 0 0" }}>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.6875rem", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>สรุปคำสั่งซื้อ</p>
            <h2 style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, lineHeight: 1.3 }}>{cls.name}</h2>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.8125rem", marginTop: 2 }}>{cls.tutor} · {cls.cefr}</p>
          </div>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>ค่าเรียน</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>฿{cls.price.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>ค่าธรรมเนียม</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>฿0</span>
            </div>
            <div className="divider" />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>รวมทั้งหมด</span>
              <span style={{ fontSize: "1.25rem", fontWeight: 800 }} className="gradient-text">฿{cls.price.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div>
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>เลือกวิธีชำระเงิน</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { id: "pm-promptpay", method: "promptpay" as const, Icon: QrCode, label: "PromptPay", sub: "สแกน QR ผ่านแอปธนาคาร — แนะนำ", badge: "แนะนำ" },
              { id: "pm-card", method: "card" as const, Icon: CreditCard, label: "บัตรเครดิต / เดบิต", sub: "Visa, Mastercard, JCB", badge: null },
            ].map((opt) => (
              <button
                key={opt.id} id={opt.id} onClick={() => setMethod(opt.method)}
                className="glass-card"
                style={{ width: "100%", cursor: "pointer", border: method === opt.method ? "2px solid var(--brand-500)" : "1px solid var(--surface-border)", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: "16px", background: method === opt.method ? "var(--brand-50)" : "var(--surface-card)", boxShadow: method === opt.method ? "0 0 0 3px rgba(6,199,85,0.1)" : "var(--shadow-sm)", transition: "all 0.2s ease" }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 14, background: method === opt.method ? "var(--brand-100)" : "var(--neutral-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s ease" }}>
                  <opt.Icon size={20} style={{ color: method === opt.method ? "var(--brand-600)" : "var(--text-tertiary)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>{opt.label}</span>
                    {opt.badge && <span style={{ background: "var(--brand-100)", color: "var(--brand-700)", fontSize: "0.625rem", fontWeight: 700, padding: "2px 8px", borderRadius: 8 }}>{opt.badge}</span>}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 2 }}>{opt.sub}</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${method === opt.method ? "var(--brand-500)" : "var(--neutral-300)"}`, background: method === opt.method ? "var(--brand-500)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s ease" }}>
                  {method === opt.method && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Secure badges */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "8px 0" }}>
          {["🔒 SSL ปลอดภัย", "✅ Omise Certified", "🏛️ PCI DSS"].map((badge) => (
            <span key={badge} style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", fontWeight: 500 }}>{badge}</span>
          ))}
        </div>

        <button id="btn-proceed-payment" className="btn btn-primary btn-full btn-lg shine-effect" onClick={handleProceed} style={{ borderRadius: 18 }}>
          ดำเนินการชำระเงิน <ChevronRight size={18} />
        </button>

        <p style={{ textAlign: "center", fontSize: "0.6875rem", color: "var(--text-tertiary)", lineHeight: 1.65 }}>
          ชำระเงินครั้งเดียว ไม่มีค่าบริการเพิ่มเติม<br />สอบถามเพิ่มเติมติดต่อทีมงานผ่าน LINE
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
