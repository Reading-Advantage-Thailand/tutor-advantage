"use client";

import Link from "next/link";
import { BrandLockup } from "@/components/auth/BrandLockup";
import { ErrorState } from "@/components/app/ErrorState";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/**
 * Fallback for routes without their own boundary (entry, legal, invite):
 * the brand row, then the error card (tone tile, cause, "ลองใหม่" + a way
 * home, the reference code for support).
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-app px-4 pt-[calc(var(--safe-top)+12px)] pb-[calc(var(--safe-bottom)+24px)] text-fg sm:px-8">
      <header className="mx-auto flex w-full max-w-5xl items-center">
        <BrandLockup size="sm" href="/" />
      </header>
      <main className="flex flex-1 items-center justify-center py-10">
        <ErrorState
          page
          className="w-full max-w-md"
          description={t("shell.errorPageBody")}
          onRetry={reset}
          digest={error.digest}
          action={
            <Button variant="ghost" render={<Link href="/" />} nativeButton={false}>
              {t("app.notFoundAction")}
            </Button>
          }
        />
      </main>
    </div>
  );
}
