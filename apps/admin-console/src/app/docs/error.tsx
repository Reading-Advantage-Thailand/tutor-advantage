"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { CopyButton, StatusScreen } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Route error boundary for /docs (same as the default in app/error.tsx). */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-6">
      <StatusScreen
        role="alert"
        icon={AlertTriangle}
        tone="red"
        title={t("shell.errorTitle")}
        description={t("shell.errorPageBody")}
        actions={
          <Button size="lg" className="w-full" onClick={reset}>
            <RotateCw aria-hidden="true" />
            {t("shell.retry")}
          </Button>
        }
      >
        {error.digest ? (
          <p className="mt-4 inline-flex max-w-full flex-wrap items-center justify-center gap-x-1 text-xs text-fg-subtle">
            {t("shell.errorCode")}: <span className="font-mono break-all">{error.digest}</span>
            <CopyButton value={error.digest} label={t("shell.copyId")} />
          </p>
        ) : null}
      </StatusScreen>
    </div>
  );
}
