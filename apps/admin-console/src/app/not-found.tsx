"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileQuestion, Home } from "lucide-react";
import { PublicFrame, ShellTitle, StatusScreen, useAdminSession } from "@/components/app";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { isPublicPath } from "@/lib/routes";

/**
 * App-wide 404 (patterns.md "Not found", admin: a status card with a tone
 * tile, the cause and one primary "กลับหน้าภาพรวม"). Signed in it sits in the
 * shell's content area and names itself in the app bar / breadcrumb; signed
 * out (a disabled dev route) it gets the bare brand frame (PublicFrame). The
 * mistyped path itself is not echoed, so nothing long has to wrap here.
 */
export default function NotFound() {
  const user = useAdminSession();
  const pathname = usePathname() ?? "/";
  const card = (
    <StatusScreen
      icon={FileQuestion}
      tone="neutral"
      title={t("shell.notFoundTitle")}
      description={t("shell.notFoundBody")}
      actions={
        <Link href="/" className={buttonVariants({ size: "lg", className: "w-full" })}>
          <Home aria-hidden="true" />
          {t("shell.backHome")}
        </Link>
      }
    />
  );
  // Same rule as AdminShell: without a session (or on a public path) there is no shell around this page.
  if (!user || isPublicPath(pathname)) return <PublicFrame>{card}</PublicFrame>;
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-6">
      <ShellTitle title={t("shell.notFoundTitle")} />
      {card}
    </div>
  );
}
