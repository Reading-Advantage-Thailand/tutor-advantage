import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/security";
import { t } from "@/lib/i18n";
import { DevDatabaseClient } from "./DevDatabaseClient";
import "@/locales/th/dev";

export const metadata: Metadata = {
  title: t("dev.dbTitle"),
  robots: { index: false, follow: false },
};

/** Dev-only database inspector / TRUNCATE. 404 unless dev routes are enabled (middleware gates it too). */
export default function DevDatabasePage() {
  if (!devRoutesEnabled()) notFound();
  return <DevDatabaseClient />;
}
