import type { ReactNode } from "react";
import { ToneHero } from "@/components/mobile/Hero";
import { t } from "@/lib/i18n";

/**
 * Tab-root header of Progress as the student hero (components.md §3.3: home,
 * class detail, progress): flat brand hero with the page's one h1, an optional
 * level chip, and the class/book pickers under it. No Reedy here (patterns.md
 * S9): the empty state keeps the screen's one Reedy. The stat strip that
 * follows overlaps its rounded bottom. Server-compatible.
 */
export function ProgressHeader({ actions, children }: { actions?: ReactNode; children?: ReactNode }) {
  return (
    <ToneHero as="header" className="pt-[calc(var(--safe-top)+20px)]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="t-display min-w-0 flex-1 text-balance">{t("progress.title")}</h1>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {children ? <div className="mt-3 flex flex-col gap-2">{children}</div> : null}
    </ToneHero>
  );
}
