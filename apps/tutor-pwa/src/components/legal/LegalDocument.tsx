import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { BrandLockup } from "@/components/auth/BrandLockup";
import { IconTile } from "@/components/app/Atoms";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { HELP_URL } from "@/components/app/constants";
import { t } from "@/lib/i18n";

/** One section of tutorLegalCopy (privacy / terms). */
export interface LegalSection {
  readonly title: string;
  readonly body?: string;
  readonly items?: readonly string[];
}

export interface LegalDocumentProps {
  title: string;
  icon: LucideIcon;
  intro: string;
  sections: readonly LegalSection[];
  /** The other legal document (privacy ↔ terms). */
  related: { href: string; label: string };
}

const sectionId = (index: number) => `section-${index + 1}`;

function TocLinks({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <ol className="grid gap-0.5">
      {sections.map((section, index) => (
        <li key={section.title}>
          <a
            href={`#${sectionId(index)}`}
            className="block rounded-lg px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-press hover:text-fg"
          >
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * Readable legal document for logged-out visitors (no app shell): slim header
 * with back-to-sign-in, a ~68ch reading column, a sticky table of contents on
 * lg+ and a collapsible one on phones. Server component.
 */
export function LegalDocument({
  title,
  icon,
  intro,
  sections,
  related,
}: LegalDocumentProps) {
  return (
    <div className="min-h-dvh bg-app text-fg">
      <header className="sticky top-0 z-(--z-sticky) border-b border-hairline bg-surface pt-(--safe-top)">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="-ml-2 inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-fg-muted transition-colors hover:bg-press hover:text-fg"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {t("app.backToLogin")}
          </Link>
          <div className="flex items-center gap-2">
            <BrandLockup size="sm" className="hidden sm:flex" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-6 pb-[calc(var(--safe-bottom)+40px)] sm:px-6 md:pt-10 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <nav aria-labelledby="toc-title" className="hidden lg:block">
          <div className="sticky top-[calc(56px+var(--safe-top)+40px)]">
            <h2
              id="toc-title"
              className="mb-2 px-3 text-xs font-semibold text-fg-subtle"
            >
              {t("app.legalTocTitle")}
            </h2>
            <TocLinks sections={sections} />
          </div>
        </nav>

        <main className="min-w-0">
          <article className="max-w-[68ch]">
            <header>
              <div className="flex items-center gap-3">
                <IconTile icon={icon} tone="brand" size="lg" />
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium text-fg-muted">
                    {t("app.legalDocumentLabel")}
                  </p>
                  <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                </div>
              </div>
              <p className="mt-3 text-[0.8125rem] text-fg-subtle">
                {t("app.lastUpdated")}
              </p>
              <p className="mt-5 text-base leading-relaxed text-fg">{intro}</p>
            </header>

            <details className="group mt-6 rounded-xl border border-hairline bg-surface lg:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {t("app.legalTocTitle")}
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 text-fg-subtle transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="border-t border-hairline p-1.5">
                <TocLinks sections={sections} />
              </div>
            </details>

            <div className="mt-8 grid gap-8 border-t border-hairline pt-8">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  id={sectionId(index)}
                  className="scroll-mt-[calc(56px+var(--safe-top)+16px)]"
                >
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                  {section.body ? (
                    <p className="mt-2 text-base leading-relaxed text-fg">
                      {section.body}
                    </p>
                  ) : null}
                  {section.items?.length ? (
                    <ul className="mt-2 grid list-disc gap-2 pl-5 text-base leading-relaxed text-fg marker:text-fg-subtle">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <footer className="mt-10 grid gap-3 sm:grid-cols-2">
              <a
                href={HELP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong"
              >
                <IconTile icon={MessageCircle} tone="brand" size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">
                    {t("app.legalContactTitle")}
                  </span>
                  <span className="mt-0.5 block text-[0.8125rem] text-fg-muted">
                    {t("app.legalContactBody")}
                  </span>
                  <span className="mt-2 block text-[0.8125rem] font-semibold text-brand-fg">
                    {t("app.legalContactAction")}
                  </span>
                </span>
              </a>
              <Link
                href={related.href}
                className="flex items-start gap-3 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong"
              >
                <IconTile icon={FileText} tone="neutral" size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">
                    {t("app.legalRelatedTitle")}
                  </span>
                  <span className="mt-0.5 block text-[0.8125rem] text-fg-muted">
                    {related.label}
                  </span>
                </span>
              </Link>
            </footer>
          </article>
        </main>
      </div>
    </div>
  );
}
