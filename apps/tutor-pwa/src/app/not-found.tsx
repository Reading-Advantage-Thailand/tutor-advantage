import type { Metadata } from "next";
import Link from "next/link";
import { House, SearchX } from "lucide-react";
import { BrandLockup } from "@/components/auth/BrandLockup";
import { IconTile } from "@/components/app/Atoms";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";

export const metadata: Metadata = { title: t("app.notFoundTitle") };

/**
 * App-wide 404 (rendered without the dashboard shell; patterns.md "Not
 * found", tutor: a status card with a tone tile, the cause and one primary
 * "กลับหน้าแรก"). "/" forwards signed-in tutors to /dashboard.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-app px-4 pt-[calc(var(--safe-top)+12px)] pb-[calc(var(--safe-bottom)+24px)] text-fg sm:px-8">
      <header className="mx-auto flex w-full max-w-5xl items-center">
        <BrandLockup size="sm" href="/" />
      </header>
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="ds-card flex w-full max-w-md flex-col items-center px-6 pt-10 pb-8 text-center sm:px-10">
          <IconTile icon={SearchX} tone="neutral" size="xl" />
          <h1 className="mt-5 font-heading text-[1.5rem] leading-[1.35] font-semibold text-balance-th">
            {t("app.notFoundTitle")}
          </h1>
          <p className="mt-1.5 max-w-sm type-body text-fg-muted">{thaiCopy(t("app.notFoundBody"))}</p>
          <Button size="xl" className="mt-7 w-full sm:w-auto" render={<Link href="/" />} nativeButton={false}>
            <House aria-hidden="true" />
            {t("app.notFoundAction")}
          </Button>
        </div>
      </main>
    </div>
  );
}
