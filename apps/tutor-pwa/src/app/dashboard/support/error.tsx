"use client";

import { ErrorState } from "@/components/app";
import { t } from "@/lib/i18n";

export default function SupportError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      page
      title={t("dashboardSupport.loadErrorTitle")}
      description={t("dashboardSupport.loadErrorDescription")}
      onRetry={reset}
      digest={error.digest}
    />
  );
}
