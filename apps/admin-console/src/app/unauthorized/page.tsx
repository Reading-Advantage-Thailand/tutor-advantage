import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE, verifyAdminToken } from "@/lib/security";
import { t } from "@/lib/i18n";
import { UnauthorizedView } from "./UnauthorizedView";

export const metadata: Metadata = {
  title: t("unauthorized.pageTitle"),
  robots: { index: false, follow: false },
};

/**
 * Two cases:
 * - signed in (e.g. a finance checker opened an ADMIN-only page): say which
 *   account is active, link home, offer logout / switch account;
 * - not signed in (a Google account without an admin role): explain how to
 *   get access and go back to login.
 */
export default async function UnauthorizedPage() {
  const session = await verifyAdminToken((await cookies()).get(ADMIN_TOKEN_COOKIE)?.value);
  return (
    <UnauthorizedView
      session={
        session
          ? {
              name: session.name || session.email || t("shell.account"),
              role: session.role === "ADMIN" ? t("shell.roleAdmin") : t("shell.roleFinanceChecker"),
            }
          : null
      }
    />
  );
}
