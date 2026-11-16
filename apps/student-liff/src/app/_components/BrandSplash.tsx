import type { ReactNode } from "react";
import { Screen } from "@/components/mobile/Screen";
import { BrandMark } from "@/components/icons/BrandMark";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Flat hero surface for the entry screens (splash, login): --hero-bg-base with
 * the two decorative blobs (`hero-surface`). Pair with text-hero-fg.
 */
export const ENTRY_HERO_BG = "hero-surface";

export interface BrandSplashProps {
  /** Status line under the progress bar (also announced to screen readers). */
  label?: string;
  /** Replaces the progress bar with an action (e.g. a LINE login button). */
  action?: ReactNode;
}

/**
 * Lightweight branded launch screen for the LIFF entry ("/") and /login while
 * LIFF starts or a redirect runs: the flat hero colour with its two blobs, the
 * TA mark, the product name (Kodchasan 700) and a thin indeterminate bar (no
 * spinner, no Reedy as a loader; static under reduced motion). Server-compatible.
 */
export function BrandSplash({ label = t("entry.splashOpening"), action }: BrandSplashProps) {
  return (
    <Screen className={cn(ENTRY_HERO_BG, "rounded-none text-hero-fg")}>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pt-[var(--safe-top)] pb-[calc(40px+var(--safe-bottom))] text-center">
        <BrandMark size="xl" />
        <h1 className="mt-6 font-heading text-[26px] leading-[1.3] font-bold">{t("entry.brandName")}</h1>
        <p className="mt-1 text-[15px] leading-[1.6] font-medium text-hero-fg-muted">{t("app.studentPortal")}</p>

        {action ? (
          <div className="mt-10 flex w-full max-w-[360px] flex-col items-stretch gap-3">{action}</div>
        ) : (
          <div className="mt-10 flex flex-col items-center">
            <div aria-hidden="true" className="relative h-1.5 w-28 overflow-hidden rounded-full bg-hero-track">
              <span className="absolute inset-0 animate-[skeleton-sweep_1.4s_ease-in-out_infinite] rounded-full bg-brand-vivid [transform:translateX(-100%)] motion-reduce:animate-none motion-reduce:[transform:none]" />
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
