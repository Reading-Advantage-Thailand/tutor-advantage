import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
// Deep imports: this is a server component, keep the client barrel out of it.
import { AppBar } from "@/components/mobile/AppBar";
import { IconTile, type IconTileTone } from "@/components/mobile/IconTile";
import { Screen } from "@/components/mobile/Screen";
import { t } from "@/lib/i18n";
import { LegalSections, type LegalSection } from "./LegalSections";

export interface DocumentPageProps {
  /** Document title (shown in the AppBar). */
  title: string;
  icon: LucideIcon;
  tone?: IconTileTone;
  /** Lead paragraph. */
  intro: string;
  sections: readonly LegalSection[];
  /** Extra block after the sections (contact card, copyright note…). */
  footer?: ReactNode;
}

/**
 * Static legal document screen (privacy policy, terms). Server component; the
 * AppBar is the only client island. Back goes to the previous in-app screen
 * (profile, login, consent…) or "/" when opened directly.
 */
export function DocumentPage({ title, icon, tone = "brand", intro, sections, footer }: DocumentPageProps) {
  return (
    <Screen>
      <AppBar title={title} back fallbackHref="/" />
      <article className="mx-auto w-full max-w-2xl px-4 pt-3 pb-[calc(32px+var(--safe-bottom))]">
        <div className="rounded-[var(--radius-card)] border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <IconTile icon={icon} tone={tone} size="lg" />
            <p className="text-[13px] leading-[1.5] font-medium text-fg-muted">{t("legal.lastUpdated")}</p>
          </div>
          <p className="mt-4 text-base leading-[1.7] font-medium text-fg">{intro}</p>
          <hr className="my-6 border-hairline" />
          <LegalSections sections={sections} />
        </div>
        {footer ? <div className="mt-4">{footer}</div> : null}
      </article>
    </Screen>
  );
}

/** Skeleton mirroring DocumentPage (used by the privacy/terms loading.tsx). */
export function DocumentPageSkeleton({ title }: { title: string }) {
  return (
    <Screen>
      <AppBar title={title} back fallbackHref="/" />
      <div aria-hidden="true" className="mx-auto w-full max-w-2xl px-4 pt-3">
        <div className="rounded-[var(--radius-card)] border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="skeleton-block size-12 rounded-2xl" />
            <div className="skeleton-block h-3.5 w-40 rounded-full" />
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <div className="skeleton-block h-4 w-full rounded-full" />
            <div className="skeleton-block h-4 w-11/12 rounded-full" />
            <div className="skeleton-block h-4 w-4/5 rounded-full" />
          </div>
          <div className="my-6 h-px bg-hairline" />
          {[0, 1, 2].map((index) => (
            <div key={index} className="mb-7 flex flex-col gap-3">
              <div className="skeleton-block h-5 w-1/2 rounded-full" />
              <div className="skeleton-block h-4 w-full rounded-full" />
              <div className="skeleton-block h-4 w-5/6 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
