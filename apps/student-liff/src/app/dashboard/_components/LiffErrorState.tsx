"use client";

import { LogIn } from "lucide-react";
import { ErrorState } from "@/components/mobile";
import { useLiff, type LiffErrorCode } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/**
 * Friendly screen for a LIFF start-up problem (no profile / init failed), so a
 * tab root never spins forever. Shared by Home, Progress and Profile.
 *
 * - network → offline copy + retry (reloads: liff.init() runs once per page)
 * - auth (or no profile without an error) → "log in again" + retry
 * - config / unknown → generic copy + retry
 */
export function LiffErrorState({ className }: { className?: string }) {
  const { errorCode, retry, logout } = useLiff();
  const code: LiffErrorCode = errorCode ?? "auth";

  if (code === "network") {
    return <ErrorState kind="offline" onRetry={retry} className={className} />;
  }

  if (code === "auth") {
    return (
      <ErrorState
        title={t("dashboard.startupAuthTitle")}
        description={t("dashboard.startupAuthError")}
        onRetry={retry}
        className={className}
        secondaryAction={
          <Button variant="brandSoft" size="touch" onClick={logout}>
            <LogIn aria-hidden="true" />
            {t("dashboard.loginAgain")}
          </Button>
        }
      />
    );
  }

  return (
    <ErrorState
      description={code === "config" ? t("dashboard.startupConfigError") : undefined}
      onRetry={retry}
      className={className}
    />
  );
}
