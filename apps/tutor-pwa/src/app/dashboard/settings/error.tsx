"use client";

import { ErrorState } from "@/components/app/ErrorState";
import { t } from "@/lib/i18n";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      page
      title={t("dashboardSettings.errorTitle")}
      description={t("shell.errorPageBody")}
      onRetry={reset}
      digest={error.digest}
    />
  );
}
