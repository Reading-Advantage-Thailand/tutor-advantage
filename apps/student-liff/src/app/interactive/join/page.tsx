"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";

export default function JoinLessonPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-black text-foreground mb-3">
          {t("interactiveJoin.title")}
        </h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          {t("interactiveJoin.description")}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("interactiveJoin.backHome")}
        </Link>
      </div>
    </div>
  );
}
