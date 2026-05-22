"use client";

import Link from "next/link";
import { ChevronLeft, ShieldCheck, FileCheck, Calendar, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Card } from "@/components/ui/card";
import { studentLegalCopy, t } from "@/lib/i18n";

export default function ConsentPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-bg)", color: "var(--text-primary)", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, width: "100%", borderBottom: "1px solid var(--surface-border)", background: "var(--surface-card-trans)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: "768px", margin: "0 auto", display: "flex", height: "56px", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
          <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}>
            <ChevronLeft size={18} />
            <span>{t("app.consentProfile")}</span>
          </Link>
          <ThemeToggle size={16} />
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: "768px", margin: "0 auto", width: "100%", padding: "24px 16px 80px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
            {t("app.consentTitle")}
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {t("app.consentSubtitle")}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {studentLegalCopy.consents.map((consent) => (
            <Card key={consent.title} className="glass-card" style={{ padding: "16px", border: "1px solid var(--surface-border)" }}>
              <div style={{ display: "flex", gap: "14px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: consent.status === "ACTIVE" ? "var(--accent-emerald-light)" : "var(--neutral-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {consent.status === "ACTIVE" ? (
                    <ShieldCheck size={20} style={{ color: "rgb(16, 185, 129)" }} />
                  ) : (
                    <FileCheck size={20} style={{ color: "var(--neutral-400)" }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)" }}>{consent.title}</h3>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: consent.status === "ACTIVE" ? "rgba(16, 185, 129, 0.1)" : "rgba(107, 114, 128, 0.1)", color: consent.status === "ACTIVE" ? "rgb(5, 150, 105)" : "var(--text-secondary)" }}>
                      {consent.status === "ACTIVE" ? t("app.consentActive") : t("app.consentInactive")}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "12px" }}>
                    {consent.description}
                  </p>
                  {consent.status === "ACTIVE" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                      <Calendar size={12} />
                      <span>{t("app.consentDatePrefix")} {consent.date}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div style={{ marginTop: "32px", padding: "16px", borderRadius: "16px", background: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(251, 191, 36, 0.2)", display: "flex", gap: "12px" }}>
          <AlertCircle size={20} style={{ color: "rgb(217, 119, 6)", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "rgb(180, 83, 9)", marginBottom: "4px" }}>{t("app.revokeConsentTitle")}</h4>
            <p style={{ fontSize: "0.8125rem", color: "rgb(180, 83, 9)", lineHeight: 1.6 }}>
              {t("app.revokeConsentDescription")}
            </p>
          </div>
        </div>

        <div style={{ marginTop: "40px", textAlign: "center", display: "flex", flexDirection: "column", gap: "12px" }}>
          <Link href="/privacy" style={{ fontSize: "0.8125rem", color: "var(--brand-600)", textDecoration: "none", fontWeight: 500 }}>
            {t("app.readFullPrivacy")}
          </Link>
          <Link href="/terms" style={{ fontSize: "0.8125rem", color: "var(--brand-600)", textDecoration: "none", fontWeight: 500 }}>
            {t("app.readFullTerms")}
          </Link>
        </div>
      </main>
    </div>
  );
}
