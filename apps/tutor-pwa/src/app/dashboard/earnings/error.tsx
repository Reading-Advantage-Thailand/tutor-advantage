"use client";

import { ErrorState } from "@/components/app/ErrorState";
import { t } from "@/lib/i18n";

export default function EarningsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      page
      title={t("dashboardEarnings.errorTitle")}
      description={t("dashboardEarnings.errorDescription")}
      onRetry={reset}
      digest={error.digest}
    />
  );
}
