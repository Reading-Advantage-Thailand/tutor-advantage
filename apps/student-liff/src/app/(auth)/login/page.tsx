"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Notice, Screen } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { BrandMark } from "@/components/icons/BrandMark";
import { LineIcon } from "@/components/icons/LineIcon";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { waitForSession } from "@/lib/cookieUtils";
import { BrandSplash, ENTRY_HERO_BG } from "../../_components/BrandSplash";
import { LiffErrorScreen } from "../../_components/LiffErrorScreen";
import { SESSION_ERROR_DETAIL, getLiffErrorKind, safeIsLoggedIn } from "../../_components/liffErrors";
import { useLiffRecovery } from "../../_components/useLiffRecovery";
import { getSafeRedirect } from "./_components/loginRedirect";

/** Inline legal link with a ~44px tall hit area inside the sentence. */
const legalLinkClass =
  "-my-3 inline-block rounded-md py-3 font-semibold text-brand-fg underline decoration-brand-fg/40 underline-offset-4 active:bg-press";

export default function LoginPage() {
  const { liff, isReady, error, errorCode } = useLiff();
  const router = useRouter();
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Only same-origin paths (no open redirect); defaults to /dashboard.
  const redirectPath = getSafeRedirect(typeof window !== "undefined" ? window.location.search : null);
  const recover = useLiffRecovery(redirectPath);
  const isLoggedIn = isReady && safeIsLoggedIn(liff);

  // Logged in to LINE: wait until the student-session cookie is confirmed, then go on.
  useEffect(() => {
    if (isReady && !error && safeIsLoggedIn(liff)) {
      let cancelled = false;
      void waitForSession(20, 250).then((hasSession) => {
        if (cancelled) return;
        if (hasSession) router.replace(redirectPath);
        else setSessionError(SESSION_ERROR_DETAIL);
      });

      return () => {
        cancelled = true;
      };
    }
  }, [isReady, liff, error, router, redirectPath]);

  if (error || sessionError) {
    const kind = getLiffErrorKind(errorCode, sessionError);
    return (
      <LiffErrorScreen
        kind={kind}
        details={error ?? sessionError}
        retrying={retrying}
        onRetry={() => {
          setRetrying(true);
          recover(kind);
        }}
      />
    );
  }

  // Starting up, or logged in and waiting for the session → splash (never an endless spinner:
  // waitForSession gives up after ~5s and the error screen above takes over).
  if (!isReady || isLoggedIn) {
    return <BrandSplash label={t("app.preparingLogin")} />;
  }

  const handleLogin = () => {
    if (liff && !safeIsLoggedIn(liff)) {
      try {
        liff.login({ redirectUri: window.location.origin + redirectPath });
      } catch (err) {
        console.error("LoginPage: liff.login() failed:", err);
      }
    }
  };

  return (
    <Screen className={cn(ENTRY_HERO_BG, "text-hero-fg")}>
      {/* Brand */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-[calc(var(--safe-top)+40px)] pb-10 text-center">
        <BrandMark size="xl" tone="onBrand" />
        <p className="mt-5 text-[28px] leading-[1.3] font-extrabold tracking-tight">{t("entry.brandName")}</p>
        <p className="mt-1 text-[15px] leading-[1.6] font-medium text-hero-fg-muted">{t("app.studentPortal")}</p>
      </div>

      {/* Login sheet */}
      <section
        aria-labelledby="login-title"
        className="rounded-t-[28px] bg-surface px-5 pt-7 pb-[calc(20px+var(--safe-bottom))] text-fg shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.35)]"
      >
        <div className="mx-auto w-full max-w-md">
          <h1 id="login-title" className="text-center text-xl leading-[1.4] font-extrabold">
            {t("app.login")}
          </h1>
          <p className="mt-1 text-center text-sm leading-[1.6] text-fg-muted">{t("app.loginSubtitle")}</p>

          <Button
            id="btn-line-login"
            variant="line"
            size="cta"
            className="mt-6 w-full"
            onClick={handleLogin}
            disabled={!isReady}
          >
            <LineIcon variant="mono" size={26} />
            {t("app.lineLogin")}
          </Button>

          <p className="mt-4 text-center text-[13px] leading-[1.7] text-fg-muted">
            {t("app.loginConsentPrefix")}{" "}
            <Link href="/terms" className={legalLinkClass}>
              {t("app.terms")}
            </Link>{" "}
            {t("app.and")}{" "}
            <Link href="/privacy" className={legalLinkClass}>
              {t("app.privacyPolicy")}
            </Link>
          </p>

          <Notice
            tone="warning"
            icon={Users}
            title={t("app.underagePrefix")}
            description={t("app.underageNotice")}
            className="mt-5"
          />

          <p className="mt-6 text-center text-xs leading-[1.6] text-fg-muted">
            {t("entry.copyright")}
            <br />
            {t("app.securePaymentLine")}
          </p>
        </div>
      </section>
    </Screen>
  );
}
