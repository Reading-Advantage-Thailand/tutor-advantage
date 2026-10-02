"use client";

import { ErrorState } from "@/components/app";
import { t } from "@/lib/i18n";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState page title={t("shell.errorTitle")} description={t("shell.errorPageBody")} onRetry={reset} digest={error.digest} />;
}
