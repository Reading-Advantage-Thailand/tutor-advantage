"use client";

import { ErrorState } from "@/components/app";
import { t } from "@/lib/i18n";

export default function ClassesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      page
      title={t("tutorClass.ui.listErrorTitle")}
      description={t("tutorClass.ui.listErrorBody")}
      onRetry={reset}
      digest={error.digest}
    />
  );
}
