"use client";

import { ErrorState, Page, PageHeader } from "@/components/app";
import { t } from "@/lib/i18n";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page>
      <PageHeader title={t("dashboardPerformance.title")} />
      <ErrorState page description={t("shell.errorPageBody")} onRetry={reset} digest={error.digest} />
    </Page>
  );
}
