"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiff } from "@/components/providers/LiffProvider";
import { LineIcon } from "@/components/icons/LineIcon";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Sparkles, ChevronRight, BookOpen, Clock, Shield, FileText } from "lucide-react";
import { t } from "@/lib/i18n";

export default function LandingPage() {
  const router = useRouter();
  const { liff, isReady, profile } = useLiff();
  const isLoggedIn = isReady && liff?.isLoggedIn();
  const [isLiffRedirecting, setIsLiffRedirecting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has("liff.state")) {
        setIsLiffRedirecting(true);
      }
    }
  }, []);

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (isReady && isLoggedIn && profile) {
      router.push("/dashboard");
    }
  }, [isReady, isLoggedIn, profile, router]);

  if (isLiffRedirecting) {
    return (
      <main className="page-shell" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-pulse" style={{ color: "var(--brand-600)", fontWeight: 600, fontSize: "1.125rem" }}>
          {t("app.redirectingLogin")}
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell" style={{ background: "var(--surface-bg)" }}>

      {/* ── Hero ── */}
      <section
        style={{
          background: "linear-gradient(160deg, #06c755 0%, #049a42 35%, #037d36 60%, #0f172a 100%)",
          padding: "52px 24px 56px",
          position: "relative",
          overflow: "hidden",
          borderRadius: "0 0 32px 32px",
        }}
      >
        {/* Decorative elements */}
        <div aria-hidden style={{ position: "absolute", top: -80, right: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.05)", filter: "blur(1px)" }} />
        <div aria-hidden style={{ position: "absolute", bottom: -50, left: -30, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
        <div aria-hidden style={{ position: "absolute", top: "40%", right: "10%", width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} className="animate-float" />
        <div aria-hidden style={{ position: "absolute", top: "25%", left: "15%", width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} className="animate-float" />

        {/* Top bar */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
          <div className="animate-fade-in" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid rgba(255,255,255,0.25)", backdropFilter: "blur(8px)" }}>
              <LineIcon size={20} />
            </div>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.01em" }}>
              Tutor Advantage
            </span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 14, border: "1.5px solid rgba(255,255,255,0.2)" }}>
            <ThemeToggle size={16} />
          </div>
        </div>

        {/* Headline */}
        <div className="animate-slide-up stagger">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: "var(--radius-full)", padding: "6px 14px", marginBottom: 20, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <Sparkles size={13} style={{ color: "#fbbf24" }} />
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
              {t("app.programBadge")}
            </span>
          </div>

          <h1 style={{ color: "#fff", fontSize: "2rem", fontWeight: 800, lineHeight: 1.2, marginBottom: 14, letterSpacing: "-0.02em" }}>
            {t("app.heroTitleLine1")}
            <br />
            <span style={{ color: "#86efac" }}>{t("app.heroTitleLine2")}</span>
            <br />
            {t("app.heroTitleLine3")}
          </h1>

          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.9375rem", lineHeight: 1.7, marginBottom: 32 }}>
            {t("app.heroSubtitleLine1")}
            <br />
            {t("app.heroSubtitleLine2")}
          </p>

          {/* CTA */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Button
              render={<Link href={isLoggedIn ? "/dashboard" : "/login"} />}
              nativeButton={false}
              className="w-full h-14 rounded-2xl text-base font-bold bg-white hover:bg-gray-50 text-[#06c755] border-none shadow-[0_4px_20px_rgba(0,0,0,0.15)] shine-effect"
              id="cta-line-login"
            >
              <LineIcon size={20} />
              {isLoggedIn ? t("app.goDashboard") : t("app.lineLogin")}
            </Button>

            <Button
              render={<Link href="/classes" />}
              nativeButton={false}
              variant="outline"
              className="w-full h-12 rounded-2xl text-sm font-semibold border-2 border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white backdrop-blur-sm"
            >
              {t("app.browseClasses")}
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ padding: "24px 20px 8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { value: "32", label: t("app.statBooks"), suffix: t("app.statBookUnit"), Icon: BookOpen },
            { value: "448", label: t("app.statArticles"), suffix: t("app.statArticleUnit"), Icon: FileText },
            { value: "1,150+", label: t("app.statHours"), suffix: "", Icon: Clock },
          ].map((stat) => (
            <div
              key={stat.label}
              className="glass-card"
              style={{ padding: "16px 12px", textAlign: "center" }}
            >
              <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--brand-600)", lineHeight: 1, marginBottom: 2 }}>
                {stat.value}
                {stat.suffix && <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--brand-500)", marginLeft: 2 }}>{stat.suffix}</span>}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 4, fontWeight: 500 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "28px 20px" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
          {t("app.howItWorksTitle")}
        </h2>

        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
          {/* Connecting line */}
          <div aria-hidden style={{ position: "absolute", left: 21, top: 44, bottom: 44, width: 2, background: "linear-gradient(180deg, var(--brand-200), var(--brand-100), transparent)", borderRadius: 2, zIndex: 0 }} />

          {[
            { step: "01", title: t("app.stepLinkTitle"), desc: t("app.stepLinkDesc"), color: "var(--brand-600)", bg: "var(--brand-50)" },
            { step: "02", title: t("app.stepPayTitle"), desc: t("app.stepPayDesc"), color: "var(--accent-blue)", bg: "var(--accent-blue-light)" },
            { step: "03", title: t("app.stepStartTitle"), desc: t("app.stepStartDesc"), color: "var(--accent-purple)", bg: "var(--accent-purple-light)" },
          ].map((item) => (
            <div
              key={item.step}
              className="animate-slide-up"
              style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "14px 0", position: "relative", zIndex: 1 }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 14, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.8125rem", fontWeight: 800, color: item.color, border: `2px solid ${item.color}22`, boxShadow: `0 2px 8px ${item.color}15` }}>
                {item.step}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)", marginBottom: 3 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Series overview ── */}
      <section style={{ padding: "4px 20px 28px" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
          {t("app.availableCourses")}
        </h2>

        <div className="scrollbar-hide" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
          {[
            { name: "Reading", cefr: "A1", levels: "3.1", tag: "Open now", color: "#06c755", gradient: "linear-gradient(135deg, #06c755, #049a42)", enabled: true },
            { name: "Reading", cefr: "A1", levels: "1-3.2", tag: "More books coming soon", color: "#64748b", gradient: "linear-gradient(135deg, #64748b, #475569)", enabled: false },
            { name: "Reading", cefr: "A2", levels: "4-6", tag: "More books coming soon", color: "#64748b", gradient: "linear-gradient(135deg, #64748b, #475569)", enabled: false },
            { name: "Reading", cefr: "B1", levels: "7-9", tag: "More books coming soon", color: "#64748b", gradient: "linear-gradient(135deg, #64748b, #475569)", enabled: false },
            { name: "Reading", cefr: "B2", levels: "10-12", tag: "More books coming soon", color: "#64748b", gradient: "linear-gradient(135deg, #64748b, #475569)", enabled: false },
            { name: "Reading", cefr: "C1", levels: "13-15", tag: "More books coming soon", color: "#64748b", gradient: "linear-gradient(135deg, #64748b, #475569)", enabled: false },
          ].map((series) => (
            <div
              key={`${series.name}-${series.levels}`}
              style={{
                minWidth: 140,
                padding: "20px 16px",
                background: series.gradient,
                borderRadius: 20,
                color: "#fff",
                flexShrink: 0,
                scrollSnapAlign: "start",
                position: "relative",
                overflow: "hidden",
                opacity: series.enabled ? 1 : 0.72,
              }}
            >
              <div aria-hidden style={{ position: "absolute", top: -15, right: -15, width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, opacity: 0.9, marginBottom: 8, letterSpacing: "0.05em" }}>
                {series.cefr} / Level {series.levels}
              </div>
              <div style={{ fontSize: "1.125rem", fontWeight: 800, marginBottom: 4 }}>
                {series.name}
              </div>
              <div style={{ fontSize: "0.6875rem", opacity: 0.8, lineHeight: 1.4 }}>
                {series.tag}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ padding: "28px 20px 44px", textAlign: "center" }}>
        <div className="glass-card" style={{ padding: "28px 24px", textAlign: "center" }}>
          <Shield size={28} style={{ color: "var(--brand-500)", marginBottom: 12 }} />
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: 18, lineHeight: 1.7 }}>
            {t("app.haveTutorLink")}
            <br />
            {t("app.continueAfterLogin")}
          </p>
          <Button
            render={<Link href={isLoggedIn ? "/dashboard" : "/login"} />}
            nativeButton={false}
            className="w-full max-w-[280px] h-12 rounded-2xl text-sm font-bold bg-[#06c755] hover:bg-[#047d36] text-white shadow-md mx-auto"
            id="cta-line-login-bottom"
          >
            <LineIcon size={18} />
            {isLoggedIn ? t("app.goDashboard") : t("app.lineLogin")}
          </Button>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 14, lineHeight: 1.6 }}>
            {t("app.secureOmiseLine")}
          </p>
        </div>
      </section>
    </main>
  );
}
