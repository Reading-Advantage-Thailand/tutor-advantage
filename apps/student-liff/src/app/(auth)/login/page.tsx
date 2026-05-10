"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/components/providers/LiffProvider";
import { LineIcon } from "@/components/icons/LineIcon";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Shield, Users } from "lucide-react";

export default function LoginPage() {
  const { liff, isReady, error } = useLiff();
  const router = useRouter();

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const redirectPath = searchParams?.get("redirect") || "/dashboard";

  useEffect(() => {
    if (isReady && liff?.isLoggedIn()) {
      router.replace(redirectPath);
    }
  }, [isReady, liff, router, redirectPath]);

  if (!isReady || (isReady && liff?.isLoggedIn())) {
    return (
      <main className="page-shell" style={{ minHeight: "100dvh", background: "linear-gradient(160deg, #06c755 0%, #047d36 40%, #0f172a 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-pulse" style={{ color: "#fff", fontWeight: 600, fontSize: "1.125rem" }}>
          กำลังเตรียมเข้าสู่ระบบ...
        </div>
      </main>
    );
  }

  const handleLogin = () => {
    if (liff && !liff.isLoggedIn()) {
      try {
        // Construct proper redirect destination
        const target = redirectPath.startsWith("/") ? redirectPath : "/" + redirectPath;
        liff.login({ redirectUri: window.location.origin + target });
      } catch (err) {
        console.error("LoginPage: liff.login() failed:", err);
      }
    }
  };

  return (
    <main className="page-shell" style={{ minHeight: "100dvh", background: "linear-gradient(160deg, #06c755 0%, #049a42 35%, #037d36 55%, #0f172a 100%)", display: "flex", flexDirection: "column" }}>
      <style>{`#liff-mock-root { z-index: 999999 !important; position: relative; }`}</style>

      {/* Decorative */}
      <div aria-hidden style={{ position: "fixed", top: -100, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "fixed", bottom: 60, left: -80, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

      {/* Theme toggle */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10, background: "rgba(255,255,255,0.1)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.15)" }}>
        <ThemeToggle size={16} />
      </div>

      {/* Top branding */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 24px 24px", textAlign: "center" }}>
        <div className="animate-bounce-in" style={{ width: 96, height: 96, borderRadius: 28, background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32, boxShadow: "0 8px 40px rgba(0,0,0,0.2), 0 0 80px rgba(6,199,85,0.15)", backdropFilter: "blur(12px)" }}>
          <span style={{ fontSize: "2rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", fontFamily: "var(--font-latin)" }}>TA</span>
        </div>

        <div className="animate-slide-up">
          <h1 style={{ color: "#fff", fontSize: "1.875rem", fontWeight: 800, marginBottom: 8, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            Tutor Advantage
          </h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.9375rem", lineHeight: 1.7 }}>
            พอร์ทัลสำหรับนักเรียน
          </p>
        </div>
      </div>

      {/* Login card */}
      <div className="animate-slide-up" style={{ margin: "0 16px 32px", borderRadius: 24, padding: "28px 24px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, textAlign: "center" }}>
          เข้าสู่ระบบ
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>
          ใช้บัญชี LINE เพื่อเข้าถึงคลาสเรียนของคุณ
        </p>

        {/* Error */}
        {error && (
          <div style={{ color: "#ef4444", fontSize: "0.75rem", textAlign: "center", marginBottom: 12, padding: "10px 14px", background: "var(--accent-red-light)", borderRadius: 14, border: "1px solid #fee2e2" }}>
            ⚠️ {error}
          </div>
        )}

        {/* LINE Login button */}
        <Button
          onClick={handleLogin}
          id="btn-line-login"
          className="w-full h-14 rounded-2xl text-base font-bold bg-[#06c755] hover:bg-[#047d36] text-white shadow-[0_4px_16px_rgba(6,199,85,0.3)] mb-4 shine-effect"
          aria-label="เข้าสู่ระบบด้วย LINE"
          disabled={!isReady}
        >
          <LineIcon size={22} />
          {isReady ? "เข้าสู่ระบบด้วย LINE" : "กำลังโหลด..."}
        </Button>

        {/* PDPA notice */}
        <div style={{ background: "var(--neutral-50)", borderRadius: 14, padding: "12px 14px", border: "1px solid var(--surface-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Shield size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>นโยบายความเป็นส่วนตัว</span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
            การเข้าสู่ระบบถือว่าคุณยอมรับ{" "}
            <a href="/terms" style={{ color: "var(--brand-600)", fontWeight: 600, textDecoration: "none" }}>เงื่อนไขการใช้งาน</a>{" "}
            และ{" "}
            <a href="/privacy" style={{ color: "var(--brand-600)", fontWeight: 600, textDecoration: "none" }}>นโยบายความเป็นส่วนตัว</a>
          </p>
        </div>

        {/* Guardian note */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 14, padding: "12px 14px", background: "var(--accent-amber-light)", borderRadius: 14, border: "1px solid #fde68a" }}>
          <Users size={16} style={{ color: "#92400e", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: "0.75rem", color: "#92400e", lineHeight: 1.65 }}>
            <strong>นักเรียนอายุต่ำกว่า 18 ปี</strong>{" "}
            ต้องได้รับความยินยอมจากผู้ปกครองก่อนชำระเงินและใช้งานช่องทางติดต่อ
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "0 24px 36px" }}>
        <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
          © 2026 Tutor Advantage Thailand
          <br />
          ชำระเงินปลอดภัยโดย Omise · PromptPay &amp; บัตรเครดิต
        </p>
      </div>
    </main>
  );
}
