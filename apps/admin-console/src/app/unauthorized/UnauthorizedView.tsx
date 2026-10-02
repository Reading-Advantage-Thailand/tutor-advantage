"use client";

import { ArrowLeft, Home, LogOut, ShieldX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BrandMark, IconTile, ThemeToggle, logout } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function UnauthorizedView({ session }: { session: { name: string; role: string } | null }) {
  const [leaving, setLeaving] = useState(false);
  const signOut = () => {
    setLeaving(true);
    void logout();
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-app px-4 py-10">
      <ThemeToggle className="absolute top-3 right-3" />
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-fg-muted">
          <BrandMark className="size-7 text-xs" />
          {t("shell.brandName")} · {t("shell.brandRole")}
        </div>
        <section className="flex flex-col items-center gap-5 rounded-2xl border border-hairline bg-surface p-6 text-center shadow-card sm:p-8">
          <IconTile icon={ShieldX} tone="red" size="lg" />
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold text-fg">
              {session ? t("unauthorized.signedInTitle") : t("unauthorized.signedOutTitle")}
            </h1>
            <p className="text-sm leading-relaxed text-fg-muted">
              {session
                ? t("unauthorized.signedInDescription", { name: session.name, role: session.role })
                : t("unauthorized.signedOutDescription")}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            {session ? (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link href="/">
                    <Home aria-hidden="true" />
                    {t("unauthorized.goHome")}
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full" onClick={signOut} loading={leaving}>
                  {leaving ? null : <LogOut aria-hidden="true" />}
                  {leaving ? t("unauthorized.loggingOut") : t("unauthorized.switchAccount")}
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link href="/login">
                    <ArrowLeft aria-hidden="true" />
                    {t("unauthorized.backLogin")}
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="w-full">
                  <a href="https://lin.ee/R7Dccj9" target="_blank" rel="noopener noreferrer">
                    {t("unauthorized.contactSupport")}
                  </a>
                </Button>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
