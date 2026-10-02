import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { BrandLockup } from "@/components/auth/BrandLockup";
import { IconTile } from "@/components/app/Atoms";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("app.notFoundTitle") };

/** App-wide 404 (rendered without the dashboard shell). "/" forwards signed-in tutors to /dashboard. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-app px-4 pt-[calc(var(--safe-top)+16px)] pb-[calc(var(--safe-bottom)+24px)] text-fg sm:px-8">
      <BrandLockup size="sm" href="/" className="self-start" />
      <main className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <IconTile icon={SearchX} tone="neutral" size="lg" />
        <h1 className="mt-4 text-xl font-bold">{t("app.notFoundTitle")}</h1>
        <p className="mt-1 max-w-sm text-sm text-fg-muted">
          {t("app.notFoundBody")}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-brand-solid px-4 text-sm font-semibold text-on-brand transition-opacity hover:opacity-90"
        >
          {t("app.notFoundAction")}
        </Link>
      </main>
    </div>
  );
}
