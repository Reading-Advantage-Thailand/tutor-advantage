"use client";

import { ErrorState } from "@/components/app";
import { t } from "@/lib/i18n";

/** Default route error boundary (copy this file into a segment to customise). */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState page title={t("shell.errorTitle")} description={t("shell.errorPageBody")} onRetry={reset} digest={error.digest} />;
}
