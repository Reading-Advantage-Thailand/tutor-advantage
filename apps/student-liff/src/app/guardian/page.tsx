"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Users, Check, ShieldAlert, Save, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLiff } from "@/components/providers/LiffProvider";
import { studentApi } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function GuardianPage() {
  const { isReady } = useLiff();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [guardianName, setGuardianName] = useState("");
  const [relation, setRelation] = useState("");
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianName || !relation || !agreed) {
      setError(t("guardian.validationError"));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await studentApi.submitGuardianConsent(guardianName, relation);
      setSuccess(true);
      setTimeout(() => {
        router.push("/profile");
      }, 2000);
    } catch (err) {
      console.error("Failed to submit guardian info:", err);
      setError(err instanceof Error ? err.message : t("guardian.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <Loader2 className="animate-spin" style={{ width: 32, height: 32, color: "var(--brand-500)" }} />
      </div>
    );
  }

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
            style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}
          >
            <ChevronLeft size={18} />
            <span>{t("profile.title")}</span>
          </Link>
          <ThemeToggle size={16} />
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: "768px", margin: "0 auto", width: "100%", padding: "24px 16px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <div style={{ 
            width: "48px", 
            height: "48px", 
            borderRadius: "14px", 
            background: "rgba(236, 72, 153, 0.15)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            color: "rgb(236, 72, 153)"
          }}>
            <Users size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "2px" }}>
              {t("guardian.title")}
            </h1>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
              {t("guardian.subtitle")}
            </p>
          </div>
        </div>

        {success ? (
          <Card className="glass-card" style={{ padding: "32px 24px", textAlign: "center", border: "1px solid var(--accent-emerald-light)", background: "rgba(16, 185, 129, 0.05)" }}>
            <div style={{ 
              width: "64px", 
              height: "64px", 
              borderRadius: "50%", 
              background: "rgb(16, 185, 129)", 
              color: "white", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              margin: "0 auto 16px" 
            }}>
              <Check size={32} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>{t("guardian.savedTitle")}</h2>
            <p style={{ fontSize: "0.9375rem", color: "var(--text-secondary)", marginBottom: "24px" }}>{t("guardian.savedDescription")}</p>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {error && (
              <div style={{ 
                padding: "12px 16px", 
                background: "rgba(239, 68, 68, 0.1)", 
                border: "1px solid rgba(239, 68, 68, 0.2)", 
                borderRadius: "12px",
                color: "#ef4444",
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <ShieldAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <Card className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label htmlFor="guardianName" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
                  {t("guardian.nameLabel")}
                </label>
                <input
                  type="text"
                  id="guardianName"
                  placeholder={t("guardian.namePlaceholder")}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 16px",
                    background: "var(--surface-card)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "12px",
                    color: "var(--text-primary)",
                    fontSize: "0.9375rem",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  className="focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="relation" style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
                  {t("guardian.relationLabel")}
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    id="relation"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: "var(--surface-card)",
                      border: "1px solid var(--surface-border)",
                      borderRadius: "12px",
                      color: "var(--text-primary)",
                      fontSize: "0.9375rem",
                      appearance: "none",
                      outline: "none"
                    }}
                    className="focus:border-emerald-500"
                    required
                  >
                    <option value="" disabled>{t("guardian.relationPlaceholder")}</option>
                    <option value="Father">{t("guardian.father")}</option>
                    <option value="Mother">{t("guardian.mother")}</option>
                    <option value="Relative">{t("guardian.relative")}</option>
                    <option value="Other">{t("guardian.other")}</option>
                  </select>
                  <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", opacity: 0.5 }}>
                    v
                  </div>
                </div>
              </div>
            </Card>

            <div style={{ display: "flex", gap: "12px", padding: "4px" }}>
              <div style={{ marginTop: "2px" }}>
                <input
                  type="checkbox"
                  id="agreed"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  style={{
                    width: "20px",
                    height: "20px",
                    cursor: "pointer",
                    accentColor: "var(--brand-600)"
                  }}
                />
              </div>
              <label htmlFor="agreed" style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5, cursor: "pointer" }}>
                {t("guardian.agreement")}
              </label>
            </div>

            <Button 
              type="submit" 
              disabled={loading || !agreed} 
              className="h-12 rounded-xl text-base font-bold w-full"
              style={{ 
                background: "linear-gradient(135deg, #06c755 0%, #049a42 100%)", 
                color: "white",
                opacity: (loading || !agreed) ? 0.6 : 1,
                boxShadow: "0 4px 12px rgba(6, 199, 85, 0.25)",
                marginTop: "12px"
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  {t("guardian.saving")}
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  {t("guardian.save")}
                </>
              )}
            </Button>
          </form>
        )}

        <div style={{ marginTop: "40px", padding: "20px", borderRadius: "16px", background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)" }}>{t("guardian.faqTitle")}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{t("guardian.faqWhyTitle")}</p>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{t("guardian.faqWhyDescription")}</p>
            </div>
            <div style={{ height: "1px", background: "var(--surface-border)" }} />
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{t("guardian.faqEditTitle")}</p>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{t("guardian.faqEditDescription")}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
