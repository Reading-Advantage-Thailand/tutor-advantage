"use client";

import { CircleAlert, FlaskConical, LogIn } from "lucide-react";
import { useState } from "react";
import { IconTile, Notice, PublicFrame, SegmentedControl } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { keepRoleTerms } from "./keepRoleTerms";
import type { LoginErrorCode } from "./loginParams";
import "@/locales/th/login";

type DevRole = "ADMIN" | "FINANCE_CHECKER";

/** Google's official "G" mark: its four brand colours are fixed by Google's branding rules (like the LINE button), so they stay literal. */
function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export interface LoginFormProps {
  /** Safe same-origin path to open after login. */
  next: string;
  hasNext: boolean;
  error: LoginErrorCode | null;
  devLogin: boolean;
}

export function LoginForm({ next, hasNext, error, devLogin }: LoginFormProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [devRole, setDevRole] = useState<DevRole>("ADMIN");
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const busy = googleLoading || devLoading;

  const googleLogin = () => {
    setGoogleLoading(true);
    // `next` rides a short-lived httpOnly cookie through Google; the callback re-validates it and returns here.
    window.location.href = `/api/auth/google${hasNext ? `?next=${encodeURIComponent(next)}` : ""}`;
  };

  const devSignIn = async () => {
    setDevLoading(true);
    setDevError(null);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: devRole }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        throw new Error(body?.error?.code === "DEV_USER_NOT_FOUND" ? t("login.devNoUser") : t("login.devFailed"));
      }
      // Full navigation so the server layout picks up the new session cookie.
      window.location.assign(next);
    } catch (err) {
      setDevError(err instanceof Error ? err.message : t("login.devFailed"));
      setDevLoading(false);
    }
  };

  return (
    <PublicFrame
      footer={<p className="mx-auto max-w-[400px] text-center text-xs leading-relaxed text-fg-subtle">{thaiCopy(t("login.footerPolicy"))}</p>}
    >
      <div className="flex w-full max-w-[400px] flex-col gap-4">
        <section aria-labelledby="login-title" className="card flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex flex-col gap-1.5">
            <h1 id="login-title" className="text-xl leading-[1.4] font-semibold text-fg text-balance-th sm:text-2xl sm:leading-[1.35]">
              {t("login.pageTitle")}
            </h1>
            <p className="text-base text-fg-muted lg:text-sm">{keepRoleTerms(t("login.pageDescription"))}</p>
          </div>

          {error ? (
            <Notice tone="danger" role="alert" title={t("login.errorTitle")}>
              {t(`login.errors.${error}`)}
            </Notice>
          ) : hasNext ? (
            <Notice tone="info">{t("login.nextNotice")}</Notice>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="xl"
            className="w-full text-[0.9375rem]"
            onClick={googleLogin}
            disabled={busy}
            loading={googleLoading}
          >
            {googleLoading ? null : <GoogleIcon />}
            {googleLoading ? t("login.googleRedirecting") : t("login.googleButton")}
          </Button>
        </section>

        {devLogin ? (
          <section aria-labelledby="dev-login-title" className="card flex flex-col gap-4 p-5 sm:px-8 sm:py-6">
            <div className="flex items-start gap-3">
              <IconTile icon={FlaskConical} tone="amber" size="sm" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <h2 id="dev-login-title" className="text-[0.9375rem] leading-normal font-semibold text-fg">
                  {t("login.devSectionTitle")}
                </h2>
                <p className="text-[0.8125rem] leading-[1.6] text-fg-muted">{thaiCopy(t("login.devSectionHint"))}</p>
              </div>
            </div>
            <SegmentedControl
              aria-label={t("login.devRoleLabel")}
              fullWidth
              value={devRole}
              onValueChange={setDevRole}
              items={[
                { value: "ADMIN", label: t("login.devRoleAdmin") },
                { value: "FINANCE_CHECKER", label: t("login.devRoleChecker") },
              ]}
            />
            {devError ? (
              <p role="alert" className="flex items-start gap-1.5 text-[0.8125rem] text-danger-fg">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>{thaiCopy(devError)}</span>
              </p>
            ) : null}
            <Button type="button" variant="secondary" className="w-full" onClick={devSignIn} disabled={busy} loading={devLoading}>
              {devLoading ? null : <LogIn aria-hidden="true" />}
              {devLoading
                ? t("login.devSigningIn")
                : t("login.devButton", { role: devRole === "ADMIN" ? t("login.devRoleAdmin") : t("login.devRoleChecker") })}
            </Button>
          </section>
        ) : null}
      </div>
    </PublicFrame>
  );
}
