import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

export interface PublicFrameProps {
  children: ReactNode;
  /** One quiet line under the content (e.g. the login policy note). */
  footer?: ReactNode;
}

/**
 * Frame for the pages that render without the admin shell (login,
 * unauthorized, a signed-out 404): a quiet 56px brand bar (TA mark + name +
 * "คอนโซลผู้ดูแลระบบ", theme toggle at the right) over the paper, the content
 * centred in <main id="main-content"> below, and an optional footer line.
 * Server-compatible.
 */
export function PublicFrame({ children, footer }: PublicFrameProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-app text-fg">
      <header className="pt-(--safe-top)">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <BrandMark size={32} />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-[0.9375rem] leading-[1.35] font-semibold text-fg">{t("shell.brandName")}</p>
            <p className="truncate text-xs leading-normal text-fg-muted">{t("shell.brandRole")}</p>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col items-center justify-center px-4 py-8 outline-none sm:py-12">
        {children}
      </main>
      {footer ? <footer className="px-4 pb-[calc(var(--safe-bottom)+24px)]">{footer}</footer> : null}
    </div>
  );
}
