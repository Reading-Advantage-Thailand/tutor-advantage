import type { Metadata } from "next";
import { devRoutesEnabled } from "@/lib/security";
import { t } from "@/lib/i18n";
import { LoginForm } from "./LoginForm";
import { loginErrorCode, safeNextPath } from "./loginParams";
import "@/locales/th/login";

export const metadata: Metadata = {
  title: t("login.pageTitle"),
  robots: { index: false, follow: false },
};

/**
 * Public login page. Server component: resolves the safe `next` path and the
 * error code, and decides whether the dev login is offered (only when dev
 * routes are enabled: ENABLE_DEV_ROUTES=true in a non-production build).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  return <LoginForm next={next} hasNext={next !== "/"} error={loginErrorCode(params.error)} devLogin={devRoutesEnabled()} />;
}
