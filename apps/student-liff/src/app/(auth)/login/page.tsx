"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/components/providers/LiffProvider";
import { LineIcon } from "@/components/icons/LineIcon";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { liff, isReady, error } = useLiff();
  const router = useRouter();

  useEffect(() => {
    if (isReady && liff?.isLoggedIn()) {
      router.replace("/dashboard");
    }
  }, [isReady, liff, router]);

  if (!isReady || (isReady && liff?.isLoggedIn())) {
    return (
      <main
        className="page-shell"
        style={{
          minHeight: "100dvh",
          background:
            "linear-gradient(160deg, #06c755 0%, #047d36 40%, #0f172a 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="animate-pulse"
          style={{ color: "#fff", fontWeight: 600, fontSize: "1.125rem" }}
        >
          กำลังเตรียมเข้าสู่ระบบ...
        </div>
      </main>
    );
  }

  const handleLogin = () => {
    if (liff && !liff.isLoggedIn()) {
      try {
        liff.login({ redirectUri: window.location.origin + "/dashboard" });
      } catch (err) {
        console.error("LoginPage: liff.login() failed:", err);
      }
    }
  };

  return (
    <main
      className="page-shell"
      style={{
        minHeight: "100dvh",
        background:
          "linear-gradient(160deg, #06c755 0%, #047d36 40%, #0f172a 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`#liff-mock-root { z-index: 999999 !important; position: relative; }`}</style>
      {/* Decorative blobs */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: -80,
          right: -80,
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
          bottom: 80,
          left: -60,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
          pointerEvents: "none",
        }}
      />

      {/* Top branding area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px 24px",
          textAlign: "center",
        }}
      >
        {/* Logo mark */}
        <div
          className="animate-bounce-in"
          style={{
            width: 88,
            height: 88,
            borderRadius: "28px",
            background: "rgba(255,255,255,0.15)",
            border: "2px solid rgba(255,255,255,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          {/* Stylized "TA" monogram */}
          <span
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.02em",
              fontFamily: "var(--font-latin)",
            }}
          >
            TA
          </span>
        </div>

        <div className="animate-slide-up">
          <h1
            style={{
              color: "#fff",
              fontSize: "1.75rem",
              fontWeight: 800,
              marginBottom: 10,
              lineHeight: 1.2,
            }}
          >
            Tutor Advantage
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: "0.9375rem",
              lineHeight: 1.7,
            }}
          >
            พอร์ทัลสำหรับนักเรียน
          </p>
        </div>
      </div>

      {/* Login card */}
      <div
        className="animate-slide-up glass"
        style={{
          margin: "0 16px 32px",
          borderRadius: "var(--radius-2xl)",
          padding: "28px 24px 24px",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "var(--neutral-900)",
            marginBottom: 6,
            textAlign: "center",
          }}
        >
          เข้าสู่ระบบ
        </h2>
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--neutral-500)",
            textAlign: "center",
            marginBottom: 24,
            lineHeight: 1.6,
          }}
        >
          ใช้บัญชี LINE เพื่อเข้าถึงคลาสเรียนของคุณ
        </p>

        {/* Error Message */}
        {error && (
          <div
            style={{
              color: "#ef4444",
              fontSize: "0.75rem",
              textAlign: "center",
              marginBottom: 12,
              padding: "8px",
              background: "#fef2f2",
              borderRadius: "var(--radius-md)",
              border: "1px solid #fee2e2",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* LINE Login button */}
        <Button
          onClick={handleLogin}
          id="btn-line-login"
          className="w-full h-14 rounded-xl text-base font-bold bg-[#06c755] hover:bg-[#047d36] text-white shadow-md mb-4"
          aria-label="เข้าสู่ระบบด้วย LINE"
          disabled={!isReady}
        >
          <LineIcon size={22} />
          {isReady ? "เข้าสู่ระบบด้วย LINE" : "กำลังโหลด..."}
        </Button>

        {/* PDPA notice */}
        <div
          style={{
            background: "var(--neutral-50)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            border: "1px solid var(--neutral-200)",
          }}
        >
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--neutral-500)",
              lineHeight: 1.7,
              textAlign: "center",
            }}
          >
            การเข้าสู่ระบบถือว่าคุณยอมรับ{" "}
            <a
              href="/terms"
              style={{
                color: "var(--brand-600)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              เงื่อนไขการใช้งาน
            </a>{" "}
            และ{" "}
            <a
              href="/privacy"
              style={{
                color: "var(--brand-600)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              นโยบายความเป็นส่วนตัว
            </a>
          </p>
        </div>

        {/* Guardian note */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginTop: 14,
            padding: "12px 14px",
            background: "var(--accent-amber-light)",
            borderRadius: "var(--radius-md)",
            border: "1px solid #fde68a",
          }}
        >
          <span style={{ fontSize: "1rem", flexShrink: 0 }}>👪</span>
          <p
            style={{ fontSize: "0.75rem", color: "#92400e", lineHeight: 1.65 }}
          >
            <strong>นักเรียนอายุต่ำกว่า 18 ปี</strong>{" "}
            ต้องได้รับความยินยอมจากผู้ปกครองก่อนชำระเงินและใช้งานช่องทางติดต่อ
          </p>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          padding: "0 24px 32px",
        }}
      >
        <p
          style={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.6,
          }}
        >
          © 2026 Tutor Advantage Thailand
          <br />
          ชำระเงินปลอดภัยโดย Omise · PromptPay &amp; บัตรเครดิต
        </p>
      </div>
    </main>
  );
}
