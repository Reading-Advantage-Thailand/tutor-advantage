"use client";

import Link from "next/link";
import { useLiff } from "@/components/providers/LiffProvider";
import { LineIcon } from "@/components/icons/LineIcon";

export default function LandingPage() {
  const { liff, isReady } = useLiff();
  const isLoggedIn = isReady && liff?.isLoggedIn();

  return (
    <main className="page-shell" style={{ background: "var(--surface-bg)" }}>
      {/* ── Hero ── */}
      <section
        style={{
          background: "linear-gradient(160deg, #06c755 0%, #047d36 55%, #0f172a 100%)",
          padding: "56px 24px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: -40,
            left: -40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
          }}
        />

        {/* Brand mark */}
        <div
          className="animate-fade-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid rgba(255,255,255,0.3)",
            }}
          >
            <LineIcon size={22} />
          </div>
          <span
            style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.02em" }}
          >
            Tutor Advantage
          </span>
        </div>

        {/* Headline */}
        <div className="animate-slide-up stagger">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.15)",
              borderRadius: "var(--radius-full)",
              padding: "5px 14px",
              marginBottom: 18,
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
              ✨ โปรแกรมภาษาอังกฤษ Origins &amp; Quest
            </span>
          </div>

          <h1
            style={{
              color: "#fff",
              fontSize: "2rem",
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: 12,
            }}
          >
            เรียนภาษาอังกฤษ<br />
            <span style={{ color: "#a7f3c0" }}>กับติวเตอร์ที่คุณ</span><br />
            ไว้วางใจ
          </h1>

          <p
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: "0.9375rem",
              lineHeight: 1.7,
              marginBottom: 28,
            }}
          >
            ระบบเรียนรู้ 15 ขั้นตอน รองรับทุกระดับ A1–C1<br />
            สมัครง่าย จ่ายสะดวก ผ่าน LINE โดยตรง
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="btn-line"
              id="cta-line-login"
              style={{ fontSize: "1rem", fontWeight: 700 }}
            >
              <LineIcon size={20} />
              {isLoggedIn ? "ไปที่หน้า Dashboard" : "เข้าสู่ระบบด้วย LINE"}
            </Link>

            <Link
              href="/classes"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "15px 24px",
                borderRadius: "var(--radius-full)",
                border: "1.5px solid rgba(255,255,255,0.4)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.9375rem",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              ดูคลาสเรียนทั้งหมด
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section
        style={{
          background: "#fff",
          padding: "20px 24px",
          borderBottom: "1px solid var(--neutral-200)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {[
            { value: "32", label: "หนังสือเรียน", suffix: "เล่ม" },
            { value: "448", label: "บทความ", suffix: "บท" },
            { value: "1,150", label: "ชั่วโมง", suffix: "เรียน" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: "var(--brand-600)",
                  lineHeight: 1,
                }}
              >
                {stat.value}
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--brand-500)", marginLeft: 2 }}>
                  {stat.suffix}
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginTop: 3, fontWeight: 500 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "28px 24px" }}>
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "var(--neutral-900)",
            marginBottom: 20,
          }}
        >
          เริ่มเรียนง่ายๆ 3 ขั้นตอน
        </h2>

        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            {
              step: "01",
              title: "รับลิงก์จากติวเตอร์",
              desc: "ติวเตอร์แชร์ลิงก์สมัครเรียนผ่าน LINE หรือ Facebook",
              color: "var(--brand-50)",
              bg: "var(--brand-50)",
            },
            {
              step: "02",
              title: "เข้าสู่ระบบและชำระเงิน",
              desc: "ล็อกอินด้วย LINE จ่ายด้วย PromptPay หรือบัตรเครดิต",
              color: "var(--accent-blue)",
              bg: "var(--accent-blue-light)",
            },
            {
              step: "03",
              title: "เริ่มเรียนได้ทันที",
              desc: "เข้าถึงบทเรียนและติดต่อติวเตอร์ผ่านแอปนี้",
              color: "var(--accent-purple)",
              bg: "var(--accent-purple-light)",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="animate-slide-up"
              style={{
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
                background: "#fff",
                borderRadius: "var(--radius-xl)",
                padding: "16px 18px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "var(--radius-md)",
                  background: item.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "0.875rem",
                  fontWeight: 800,
                  color: item.color,
                }}
              >
                {item.step}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--neutral-900)", marginBottom: 3 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", lineHeight: 1.6 }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Series overview ── */}
      <section style={{ padding: "0 24px 28px" }}>
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "var(--neutral-900)",
            marginBottom: 16,
          }}
        >
          หลักสูตรที่เปิดสอน
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { name: "Origins", cefr: "A1", levels: "1–3", tag: "Your journey starts here", color: "#06c755", textColor: "#fff" },
            { name: "Quest", cefr: "A2", levels: "4–6", tag: "Your quest awaits", color: "#3b82f6", textColor: "#fff" },
            { name: "Adventure", cefr: "B1", levels: "7–9", tag: "Your adventure&apos;s in sight", color: "#8b5cf6", textColor: "#fff" },
            { name: "Hero", cefr: "B2", levels: "10–12", tag: "You&apos;re the hero", color: "#f59e0b", textColor: "#fff" },
            { name: "Legend", cefr: "C1", levels: "13–15", tag: "Legendary stories", color: "#ef4444", textColor: "#fff" },
          ].map((series) => (
            <div
              key={series.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                background: "#fff",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-md)",
                  background: series.color,
                  color: series.textColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                  flexShrink: 0,
                  letterSpacing: "0.02em",
                }}
              >
                {series.cefr}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--neutral-900)" }}>
                  {series.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginTop: 1 }}>
                  {series.tag}
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--neutral-400)",
                  flexShrink: 0,
                  textAlign: "right",
                }}
              >
                Level {series.levels}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        style={{
          padding: "24px 24px 40px",
          textAlign: "center",
          background: "var(--brand-50)",
          borderTop: "1px solid var(--brand-100)",
        }}
      >
        <p style={{ fontSize: "0.875rem", color: "var(--neutral-600)", marginBottom: 16, lineHeight: 1.7 }}>
          มีลิงก์สมัครเรียนจากติวเตอร์แล้ว?<br />
          เข้าสู่ระบบเพื่อดำเนินการต่อได้เลย
        </p>
        <Link
          href={isLoggedIn ? "/dashboard" : "/login"}
          className="btn-line"
          id="cta-line-login-bottom"
          style={{ maxWidth: 280, margin: "0 auto" }}
        >
          <LineIcon size={20} />
          {isLoggedIn ? "ไปที่หน้า Dashboard" : "เข้าสู่ระบบด้วย LINE"}
        </Link>
        <p style={{ fontSize: "0.75rem", color: "var(--neutral-400)", marginTop: 14, lineHeight: 1.6 }}>
          ชำระเงินผ่าน PromptPay หรือบัตรเครดิต<br />
          ปลอดภัย 100% โดย Omise
        </p>
      </section>
    </main>
  );
}
