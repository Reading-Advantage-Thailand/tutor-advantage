"use client";

import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { studentLegalCopy, t } from "@/lib/i18n";

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-bg)", color: "var(--text-primary)", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, width: "100%", borderBottom: "1px solid var(--surface-border)", background: "var(--surface-card-trans)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: "768px", margin: "0 auto", display: "flex", height: "56px", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
          <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}>
            <ChevronLeft size={18} />
            <span>{t("app.back")}</span>
          </Link>
          <ThemeToggle size={16} />
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: "768px", margin: "0 auto", width: "100%", padding: "32px 20px 80px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)" }}>
              <FileText size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: "4px" }}>
                {studentLegalCopy.terms.title}
              </h1>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                {t("app.legalLastUpdated")}
              </p>
            </div>
          </div>

          <div style={{ background: "var(--surface-card)", borderRadius: "20px", padding: "24px", border: "1px solid var(--surface-border)", boxShadow: "var(--shadow-sm)" }}>
            <p style={{ fontSize: "0.9375rem", lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: "24px" }}>
              {studentLegalCopy.terms.intro}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              {studentLegalCopy.terms.sections.map((section) => (
                <section key={section.title}>
                  <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, marginBottom: "12px" }}>{section.title}</h2>
                  {"body" in section && (
                    <p style={{ fontSize: "0.875rem", lineHeight: 1.8, color: "var(--text-secondary)" }}>{section.body}</p>
                  )}
                  {"items" in section && (
                    <ul style={{ fontSize: "0.875rem", lineHeight: 1.8, color: "var(--text-secondary)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
            <div style={{ marginTop: "40px", paddingTop: "24px", borderTop: "1px solid var(--surface-border)", textAlign: "center" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                {studentLegalCopy.terms.footer}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
