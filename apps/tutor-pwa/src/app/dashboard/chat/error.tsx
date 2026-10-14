"use client";

import { ErrorState } from "@/components/app";
import { t } from "@/lib/i18n";

export default function ChatError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      page
      title={t("dashboardChat.loadErrorTitle")}
      description={t("dashboardChat.loadErrorDescription")}
      onRetry={reset}
      digest={error.digest}
    />
  );
}
