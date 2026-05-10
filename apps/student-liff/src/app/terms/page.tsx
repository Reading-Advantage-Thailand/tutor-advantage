"use client";

import Link from "next/link";
import { ChevronLeft, FileText, Scale, CheckCircle, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-bg)", color: "var(--text-primary)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header 
        style={{ 
          position: "sticky", 
          top: 0, 
          zIndex: 50, 
          width: "100%", 
          borderBottom: "1px solid var(--surface-border)", 
          background: "var(--surface-card-trans)", 
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)"
        }}
      >
        <div style={{ maxWidth: "768px", margin: "0 auto", display: "flex", height: "56px", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
          <Link
            href="/profile"
            style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.2s" }}
          >
            <ChevronLeft size={18} />
            <span>ย้อนกลับ</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ThemeToggle size={16} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: "768px", margin: "0 auto", width: "100%", padding: "32px 20px 80px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Hero Title section */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
            <div style={{ 
              width: "48px", 
              height: "48px", 
              borderRadius: "14px", 
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)"
            }}>
              <FileText size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: "4px" }}>
                เงื่อนไขการใช้งาน
              </h1>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                ปรับปรุงล่าสุด: 10 พฤษภาคม 2026
              </p>
            </div>
          </div>

          <div style={{ 
            background: "var(--surface-card)", 
            borderRadius: "20px", 
            padding: "24px", 
            border: "1px solid var(--surface-border)",
            boxShadow: "var(--shadow-sm)"
          }}>
            <p style={{ fontSize: "0.9375rem", lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: "24px" }}>
              การเข้าใช้งาน Student LIFF Portal ถือว่าท่านยอมรับข้อตกลงและเงื่อนไขการใช้งานดังต่อไปนี้ 
              หากท่านมีอายุต่ำกว่า 18 ปี การชำระเงินและการใช้งานฟีเจอร์ติดต่อสื่อสารจะต้องได้รับความยินยอมจากผู้ปกครองก่อนทุกครั้ง
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <CheckCircle size={18} style={{ color: "var(--brand-600)" }} />
                  <h2 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>1. ขอบเขตการให้บริการ</h2>
                </div>
                <ul style={{ fontSize: "0.875rem", lineHeight: 1.8, color: "var(--text-secondary)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <li>เข้าถึงเนื้อหาบทเรียน (Reading Materials, Assignments) ตามคลาสเรียนที่ท่านได้ชำระเงินลงทะเบียนไว้</li>
                  <li>ระบบสะสมคะแนน, แสดงผลการสอบ, และการจัดการความก้าวหน้าส่วนบุคคล (Progress Dashboard)</li>
                  <li>ช่องทางการชำระเงินที่ปลอดภัยสำหรับการซื้อคอร์สเรียนใหม่</li>
                </ul>
              </section>

              <section>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <Scale size={18} style={{ color: "var(--brand-600)" }} />
                  <h2 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>2. การคุ้มครองลิขสิทธิ์</h2>
                </div>
                <p style={{ fontSize: "0.875rem", lineHeight: 1.8, color: "var(--text-secondary)" }}>
                  เนื้อหาแบบฝึกหัด บทความ เสียงอ่าน และฟีเจอร์สื่อสารการเรียนการสอนทั้งหมดในระบบ 
                  ถือเป็นทรัพย์สินทางปัญญาของบริษัท ห้ามมิให้ผู้เรียนกระทำการคัดลอก, บันทึก, แคปหน้าจอเพื่อนำไปเผยแพร่ต่อ, 
                  หรือทำซ้ำเพื่อการค้าโดยเด็ดขาด
                </p>
              </section>

              <section>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <AlertCircle size={18} style={{ color: "var(--brand-600)" }} />
                  <h2 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>3. นโยบายการยกเลิกและคืนเงิน</h2>
                </div>
                <p style={{ fontSize: "0.875rem", lineHeight: 1.8, color: "var(--text-secondary)" }}>
                  การลงทะเบียนเรียนและชำระเงินสำเร็จแล้ว ระบบจะทำการตัดโควตาหนังสือและเตรียมการจัดส่งทันที 
                  จึงไม่สามารถดำเนินการขอคืนเงิน (Refund) ได้ในทุกกรณี เว้นแต่คลาสเรียนนั้นๆ ไม่สามารถเปิดสอนได้จริงตามกำหนดการ 
                  หรือเป็นไปตามนโยบายพิจารณาพิเศษของบริษัท
                </p>
              </section>
            </div>

            <div style={{ marginTop: "40px", paddingTop: "24px", borderTop: "1px solid var(--surface-border)", textAlign: "center" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                สงวนลิขสิทธิ์ © 2026 Tutor Advantage Thailand<br />
                การเปลี่ยนแปลงเงื่อนไขจะมีผลบังคับใช้เมื่อประกาศทางหน้าจอนี้ทันที
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
