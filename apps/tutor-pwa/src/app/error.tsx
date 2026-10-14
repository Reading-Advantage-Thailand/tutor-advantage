"use client";

import Link from "next/link";
import { ErrorState } from "@/components/app/ErrorState";
import { t } from "@/lib/i18n";

/** Fallback for routes without their own boundary (entry, legal, invite). */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-app px-4 py-[calc(var(--safe-top)+24px)] text-fg">
      <ErrorState
        page
        className="w-full max-w-md"
        description={t("shell.errorPageBody")}
        onRetry={reset}
        digest={error.digest}
        action={
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-fg-muted hover:bg-press hover:text-fg pointer-coarse:h-10"
          >
            {t("app.notFoundAction")}
          </Link>
        }
      />
    </div>
  );
}
