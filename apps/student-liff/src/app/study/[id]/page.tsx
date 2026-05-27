"use client";

import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { t } from "@/lib/i18n";

export default function StudyPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--surface-bg)" }}
    >
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: "var(--brand-50)" }}
      >
        <Clock size={36} style={{ color: "var(--brand-500)" }} />
      </div>
      <h1 className="text-2xl font-black text-foreground mb-2">
        {t("study.comingSoonTitle")}
      </h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
        {t("study.comingSoonDesc")}
      </p>
      <Link href="/dashboard">
        <button
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm text-white"
          style={{ background: "var(--brand-500)" }}
        >
          <ArrowLeft size={16} />
          {t("enroll.backDashboard")}
        </button>
      </Link>
    </div>
  );
}
