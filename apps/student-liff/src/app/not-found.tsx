"use client";

import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <div className="page-shell flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">{t("app.notFoundTitle")}</h2>
      <p className="mb-8" style={{ color: "var(--text-secondary)" }}>{t("app.notFoundDescription")}</p>
      <a
        href="/dashboard"
        className="px-6 py-3 text-white rounded-xl font-bold transition-colors"
        style={{ background: "var(--brand-500)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--brand-600)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand-500)")}
      >
        {t("app.backDashboard")}
      </a>
    </div>
  );
}
