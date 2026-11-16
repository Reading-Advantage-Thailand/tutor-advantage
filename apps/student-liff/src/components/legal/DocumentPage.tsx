import type { LucideIcon } from "lucide-react";
import { Clock } from "lucide-react";
import type { ReactNode } from "react";
// Deep imports: this is a server component, keep the client barrel out of it.
import { AppBar } from "@/components/mobile/AppBar";
import { IconTile, type IconTileTone } from "@/components/mobile/IconTile";
import { Screen } from "@/components/mobile/Screen";
import { checkoutPolicy } from "@/lib/content/legal";
import { thaiCopy } from "@/lib/thaiText";
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

/** Container card: rim + soft shadow, no ledge. */
const cardClass = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";

/**
 * Static legal document screen (privacy policy, terms). Server component; the
 * AppBar is the only client island. Back goes to the previous in-app screen
 * (profile, login, consent…) or "/" when opened directly. Layout: a summary
 * card (document tile, last-updated line, the lead paragraph), then one card
 * per numbered section, then the footer.
 */
export function DocumentPage({ title, icon, tone = "brand", intro, sections, footer }: DocumentPageProps) {
  return (
    <Screen>
      <AppBar title={title} back fallbackHref="/" />
      <article className="mx-auto w-full max-w-2xl px-4 pt-3 pb-[calc(32px+var(--safe-bottom))]">
        <header className={`${cardClass} p-5`}>
          <div className="flex items-center gap-3.5">
            <IconTile icon={icon} tone={tone} size="lg" />
            <p className="flex min-w-0 items-start gap-1.5 text-[13px] leading-[1.6] font-medium text-fg-muted">
              <Clock aria-hidden="true" className="mt-[3px] size-4 shrink-0" strokeWidth={2.4} />
              {checkoutPolicy.lastUpdated}
            </p>
          </div>
          <p className="mt-4 text-[17px] leading-[1.7] text-fg">{thaiCopy(intro)}</p>
        </header>
        <LegalSections sections={sections} variant="cards" className="mt-3" />
        {footer ? <div className="mt-6">{footer}</div> : null}
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
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center gap-3.5">
            <div className="skeleton-block size-14 rounded-[18px]" />
            <div className="skeleton-block h-3.5 w-40 rounded-full" />
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <div className="skeleton-block h-4 w-full rounded-full" />
            <div className="skeleton-block h-4 w-11/12 rounded-full" />
            <div className="skeleton-block h-4 w-4/5 rounded-full" />
          </div>
        </div>
        {[0, 1, 2].map((index) => (
          <div key={index} className={`${cardClass} mt-3 flex flex-col gap-3 p-[18px]`}>
            <div className="flex items-center gap-3">
              <div className="skeleton-block size-9 rounded-[12px]" />
              <div className="skeleton-block h-5 w-1/2 rounded-full" />
            </div>
            <div className="skeleton-block h-4 w-full rounded-full" />
            <div className="skeleton-block h-4 w-5/6 rounded-full" />
          </div>
        ))}
      </div>
    </Screen>
  );
}
