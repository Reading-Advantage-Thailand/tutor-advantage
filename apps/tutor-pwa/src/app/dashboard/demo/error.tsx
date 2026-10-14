"use client";

import { ErrorState } from "@/components/app/ErrorState";
import { t } from "@/lib/i18n";

export default function DemoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState page title={t("demo.errorTitle")} description={t("shell.errorPageBody")} onRetry={reset} digest={error.digest} />
  );
}
