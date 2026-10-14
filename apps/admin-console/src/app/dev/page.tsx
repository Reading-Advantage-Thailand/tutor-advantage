import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/security";
import { t } from "@/lib/i18n";
import { DevUsersClient } from "./DevUsersClient";
import "@/locales/th/dev";

export const metadata: Metadata = {
  title: t("dev.usersTitle"),
  robots: { index: false, follow: false },
};

/** Dev-only user CRUD. 404 unless ENABLE_DEV_ROUTES=true in a non-production build (middleware gates it too). */
export default function DevPage() {
  if (!devRoutesEnabled()) notFound();
  return <DevUsersClient />;
}
