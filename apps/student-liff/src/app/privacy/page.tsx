"use client";

import Link from "next/link";
import { ChevronLeft, Shield, Lock, Eye, FileText } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function PrivacyPage() {
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
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)"
            }}>
              <Shield size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: "4px" }}>
                นโยบายความเป็นส่วนตัว
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
              Tutor Advantage (&quot;เรา&quot;, &quot;พวกเรา&quot;) ตระหนักถึงความสำคัญของข้อมูลส่วนบุคคลของคุณ 
              เอกสารนี้อธิบายวิธีที่เราจัดเก็บ ประมวลผล และปกป้องข้อมูลของผู้เรียนในระบบ Student LIFF Portal 
              เพื่อให้สอดคล้องกับพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <Lock size={18} style={{ color: "var(--brand-600)" }} />
                  <h2 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>1. ข้อมูลที่เราจัดเก็บ</h2>
                </div>
                <ul style={{ fontSize: "0.875rem", lineHeight: 1.8, color: "var(--text-secondary)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <li><strong>ข้อมูลประจำตัว:</strong> ชื่อโปรไฟล์ LINE, รูปโปรไฟล์, รหัส LINE User ID เพื่อใช้ในการระบุตัวตนเข้าใช้งานระบบ</li>
                  <li><strong>ข้อมูลการศึกษา:</strong> ประวัติการเข้าเรียน, บันทึกคะแนนการทำแบบฝึกหัด, ผลสัมฤทธิ์ทางการเรียน, เลเวลผู้เรียน</li>
                  <li><strong>ข้อมูลผู้ปกครอง (กรณีต่ำกว่า 18 ปี):</strong> ชื่อผู้ปกครอง และความสัมพันธ์ เพื่อความคุ้มครองทางกฎหมายและการชำระเงิน</li>
                  <li><strong>ข้อมูลการจัดส่ง:</strong> ที่อยู่สำหรับใช้ในการตรวจสอบการกระจายหนังสือประกอบการเรียนผ่านครูผู้สอน</li>
                </ul>
              </section>

              <section>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <Eye size={18} style={{ color: "var(--brand-600)" }} />
                  <h2 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>2. วัตถุประสงค์การใช้ข้อมูล</h2>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "10px" }}>ข้อมูลของคุณถูกนำไปใช้งานเพื่อ:</p>
                <ul style={{ fontSize: "0.875rem", lineHeight: 1.8, color: "var(--text-secondary)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <li>จัดการข้อมูลการเรียน ติดตามพัฒนาการ และวิเคราะห์ผลคะแนน</li>
                  <li>ส่งการแจ้งเตือนที่เกี่ยวข้องกับการเรียน เช่น ตารางเรียน ลิงก์เข้าห้องเรียน หรือสถานะชำระเงิน ผ่านทาง LINE Notify / Messaging API</li>
                  <li>วิเคราะห์พฤติกรรมการเรียนรู้ เพื่อปรับปรุงเนื้อหาบทเรียนให้มีประสิทธิภาพยิ่งขึ้น</li>
                </ul>
              </section>

              <section>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <FileText size={18} style={{ color: "var(--brand-600)" }} />
                  <h2 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>3. การแชร์ข้อมูลและสิทธิ์ของคุณ</h2>
                </div>
                <p style={{ fontSize: "0.875rem", lineHeight: 1.8, color: "var(--text-secondary)" }}>
                  ข้อมูลจะถูกเปิดเผยให้กับ <strong>ครูผู้สอนประจำคลาส</strong> และ <strong>ผู้ดูแลระบบ (Admin)</strong> เท่านั้น 
                  จะไม่มีการนำไปขายหรือส่งต่อเพื่อวัตถุประสงค์ทางการตลาดภายนอก
                  <br /><br />
                  ท่านมีสิทธิ์ในการเรียกดู แก้ไข หรือขอลบข้อมูลออกจากระบบ (ยกเว้นประวัติการเงินที่ต้องเก็บตามกฎหมายภาษี) 
                  ได้โดยติดต่อผ่านช่องทาง Support ทางการของบริษัท
                </p>
              </section>
            </div>

            <div style={{ marginTop: "40px", padding: "16px", background: "var(--brand-50)", borderRadius: "12px", border: "1px solid var(--brand-100)", textAlign: "center" }}>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--brand-700)", marginBottom: "4px" }}>
                ติดต่อสอบถามเกี่ยวกับ PDPA
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--brand-600)" }}>
                LINE Official: @readingadvantage <br/>
                ฝ่ายดูแลข้อมูลส่วนบุคคล Tutor Advantage
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
