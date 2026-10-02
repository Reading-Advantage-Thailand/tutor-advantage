import type { ReactNode } from "react";
import { Screen } from "@/components/mobile/Screen";
import { BrandMark } from "@/components/icons/BrandMark";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Deep LINE-green background for the entry screens (splash, login, landing
 * hero). Built from the brand tokens; brand-700 → brand-800 keeps white text
 * at ≥5:1 contrast (bg-gradient-brand starts at brand-600, ~3:1 with white).
 */
export const ENTRY_HERO_BG = "bg-[linear-gradient(160deg,var(--brand-700)_0%,var(--brand-800)_100%)]";

export interface BrandSplashProps {
  /** Status line under the progress bar (also announced to screen readers). */
  label?: string;
  /** Replaces the progress bar with an action (e.g. a LINE login button). */
  action?: ReactNode;
}

/**
 * Lightweight branded launch screen for the LIFF entry ("/") and /login while
 * LIFF starts or a redirect runs. A thin indeterminate bar instead of a
 * spinner; static under reduced motion. Server-compatible.
 */
export function BrandSplash({ label = t("entry.splashOpening"), action }: BrandSplashProps) {
  return (
    <Screen className={cn(ENTRY_HERO_BG, "text-white")}>
      <div className="flex flex-1 flex-col items-center justify-center px-8 pt-[var(--safe-top)] pb-[calc(40px+var(--safe-bottom))] text-center">
        <BrandMark size="xl" tone="onBrand" />
        <p className="mt-6 text-[26px] leading-[1.3] font-extrabold tracking-tight">{t("entry.brandName")}</p>
        <p className="mt-1 text-[15px] leading-[1.6] font-medium text-white/90">{t("app.studentPortal")}</p>

        {action ? (
          <div className="mt-10 flex w-full max-w-[320px] flex-col items-stretch gap-3">{action}</div>
        ) : (
          <div className="mt-10 flex flex-col items-center">
            <div aria-hidden="true" className="relative h-1 w-28 overflow-hidden rounded-full bg-white/25">
              <span className="absolute inset-0 animate-[skeleton-sweep_1.4s_ease-in-out_infinite] bg-linear-to-r from-transparent via-white to-transparent [transform:translateX(-100%)] motion-reduce:animate-none motion-reduce:[transform:none]" />
            </div>
            <p role="status" className="mt-4 text-[15px] leading-[1.6] font-medium">
              {label}
            </p>
          </div>
        )}
      </div>
    </Screen>
  );
}
