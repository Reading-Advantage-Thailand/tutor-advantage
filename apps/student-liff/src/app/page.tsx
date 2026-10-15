"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiff } from "@/components/providers/LiffProvider";
import { LineIcon } from "@/components/icons/LineIcon";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BrandSplash } from "./_components/BrandSplash";
import { LiffErrorScreen } from "./_components/LiffErrorScreen";
import { DEFAULT_LOGIN_REDIRECT } from "./(auth)/login/_components/loginRedirect";
import { decideLandingView, getLandingTarget, hasLiffStateParam, isLineInAppBrowser } from "./_components/landingView";
import { getLiffErrorKind, safeIsLoggedIn } from "./_components/liffErrors";
import { useLiffRecovery } from "./_components/useLiffRecovery";


// The marketing page is only for regular browsers: inside LINE the entry only
// ships the splash. Browsers start downloading it while LIFF starts (below).
const loadMarketing = () => import("./_components/LandingMarketing");
const LandingMarketing = dynamic(() => loadMarketing().then((mod) => mod.LandingMarketing), {
  ssr: false,
  loading: () => <BrandSplash />,
});

const subscribeNever = () => () => {};
const readInLine = () => isLineInAppBrowser(navigator.userAgent);
const readLiffState = () => hasLiffStateParam(window.location.search);
const serverFalse = () => false;
const readLandingTarget = () => getLandingTarget(window.location.search);
const serverDefaultTarget = () => DEFAULT_LOGIN_REDIRECT;

export default function LandingPage() {
  const router = useRouter();
  const { liff, isReady, error, errorCode, profile } = useLiff();
  // Client-only facts; the server snapshot is false (the server always renders the splash anyway).
  const inLine = useSyncExternalStore(subscribeNever, readInLine, serverFalse);
  const hasLiffState = useSyncExternalStore(subscribeNever, readLiffState, serverFalse);
  const target = useSyncExternalStore(subscribeNever, readLandingTarget, serverDefaultTarget);
  const recover = useLiffRecovery(target);
  const [retrying, setRetrying] = useState(false);

  const isLoggedIn = isReady && safeIsLoggedIn(liff);
  const view = decideLandingView({
    isReady,
    hasError: Boolean(error || errorCode),
    isLoggedIn,
    hasProfile: Boolean(profile),
    inLine,
    hasLiffState,
  });

  // Logged in → deep-link target (default /dashboard). replace (not push): "/" must
  // not stay in history, otherwise Android back returns here and bounces again.
  useEffect(() => {
    if (view === "redirect") router.replace(target);
  }, [view, router, target]);

  // Regular browsers will most likely see the marketing page: fetch its chunk now.
  useEffect(() => {
    if (!isLineInAppBrowser(navigator.userAgent) && !hasLiffStateParam(window.location.search)) {
      void loadMarketing();
    }
  }, []);

  switch (view) {
    case "redirect":
      return <BrandSplash label={t("entry.splashRedirecting")} />;
    case "error": {
      const kind = getLiffErrorKind(errorCode);
      return (
        <LiffErrorScreen
          kind={kind}
          details={error}
          retrying={retrying}
          onRetry={() => {
            setRetrying(true);
            recover(kind);
          }}
        />
      );
    }
    case "lineLogin":
      return (
        <BrandSplash
          action={
            <Link
              href={target === DEFAULT_LOGIN_REDIRECT ? "/login" : `/login?redirect=${encodeURIComponent(target)}`}
              className={cn(
                buttonVariants({ size: "cta" }),
                "w-full bg-white font-bold text-brand-700 shadow-[0_6px_20px_-8px_rgb(0_0_0/0.45)] active:scale-[0.97] active:bg-white/90",
              )}
            >
              <LineIcon size={22} />
              {t("app.lineLogin")}
            </Link>
          }
        />
      );
    case "marketing":
      return <LandingMarketing isLoggedIn={isLoggedIn} />;
    default:
      return <BrandSplash />;
  }
}
