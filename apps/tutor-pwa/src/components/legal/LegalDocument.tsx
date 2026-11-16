import Link from "next/link";
import { Fragment } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { BrandLockup } from "@/components/auth/BrandLockup";
import { IconTile } from "@/components/app/Atoms";
import { cardTapClass } from "@/components/app/Surface";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { HELP_URL } from "@/components/app/constants";
import { t } from "@/lib/i18n";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";

/** One section of tutorLegalCopy (privacy / terms). */
export interface LegalSection {
  readonly title: string;
  readonly body?: string;
  readonly items?: readonly string[];
}

export interface LegalDocumentProps {
  title: string;
  /**
   * The title's authored phrases (patterns.md "Thai text": static headlines
   * break between phrases, never inside a word). Used only while they still
   * spell `title`; otherwise the plain title shows.
   */
  titlePhrases?: readonly string[];
  icon: LucideIcon;
  intro: string;
  sections: readonly LegalSection[];
  /** The other legal document (privacy ↔ terms). */
  related: { href: string; label: string };
}

const sectionId = (index: number) => `section-${index + 1}`;

/** One no-wrap span per phrase with a break opportunity between them ("นโยบาย / ความเป็นส่วนตัว"). */
function AuthoredTitle({ title, phrases }: { title: string; phrases?: readonly string[] }) {
  if (!phrases?.length || phrases.join("") !== title) return <>{title}</>;
  return (
    <>
      {phrases.map((phrase, index) => (
        <Fragment key={index}>
          {index > 0 ? <wbr /> : null}
          <span className="whitespace-nowrap">{phrase}</span>
        </Fragment>
      ))}
    </>
  );
}

function TocLinks({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <ol className="grid gap-0.5">
      {sections.map((section, index) => (
        <li key={section.title}>
          <a
            href={`#${sectionId(index)}`}
            className="flex min-h-10 items-center rounded-(--radius-ctl) px-2.5 py-1.5 type-body-s text-fg-muted transition-colors duration-(--duration-fast) outline-none hover:bg-row-hover hover:text-fg focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-solid focus-visible:outline-focus-ring pointer-coarse:min-h-11"
          >
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * Readable legal document for logged-out visitors (no app shell; redesign
 * 2026-11): a slim sticky bar with back-to-sign-in, a title block (tone tile
 * + Kodchasan title), a ~68ch reading column on paper (16/1.7), a sticky
 * contents card on lg+ and a collapsible one on phones, then two tappable
 * cards (help, the related document). Server component.
 */
export function LegalDocument({
  title,
  titlePhrases,
  icon,
  intro,
  sections,
  related,
}: LegalDocumentProps) {
  return (
    <div className="min-h-dvh bg-app text-fg">
      <header className="sticky top-0 z-(--z-sticky) border-b border-hairline bg-surface-nav pt-(--safe-top)">
        <div className="mx-auto flex h-[60px] max-w-5xl items-center justify-between gap-3 px-2 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1 rounded-(--radius-ctl) pr-3 pl-2 type-label font-semibold text-fg-muted transition-colors hover:bg-press hover:text-fg"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
            {t("app.backToLogin")}
          </Link>
          <div className="flex items-center gap-2">
            <BrandLockup size="sm" className="hidden sm:flex" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-6 pb-[calc(var(--safe-bottom)+40px)] sm:px-6 md:pt-10 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <nav aria-labelledby="toc-title" className="hidden lg:block">
          <div className="ds-card sticky top-[calc(60px+var(--safe-top)+24px)] p-2">
            <h2 id="toc-title" className="px-2.5 pt-1.5 pb-1 type-label font-semibold text-fg-subtle">
              {t("app.legalTocTitle")}
            </h2>
            <TocLinks sections={sections} />
          </div>
        </nav>

        <main className="min-w-0">
          <article className="max-w-[68ch]">
            <header>
              <div className="flex items-center gap-3.5">
                <IconTile icon={icon} tone="brand" size="xl" />
                <div className="min-w-0">
                  <p className="type-label text-fg-muted">{t("app.legalDocumentLabel")}</p>
                  <h1 className="font-heading text-[1.625rem] leading-[1.3] font-semibold text-balance-th md:text-[1.75rem]">
                    <AuthoredTitle title={title} phrases={titlePhrases} />
                  </h1>
                </div>
              </div>
              <p className="mt-3 type-caption text-fg-subtle">{t("app.lastUpdated")}</p>
              <p className="mt-5 text-base leading-[1.7] text-fg">{thaiCopy(intro)}</p>
            </header>

            <details className="group ds-card mt-6 lg:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-(--radius-card) px-4 type-card text-fg outline-none focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-solid focus-visible:outline-focus-ring [&::-webkit-details-marker]:hidden">
                {t("app.legalTocTitle")}
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 text-fg-subtle transition-transform duration-(--duration-fast) group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <div className="border-t border-hairline p-1.5">
                <TocLinks sections={sections} />
              </div>
            </details>

            <div className="mt-8 grid gap-9 border-t border-hairline pt-8">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  id={sectionId(index)}
                  aria-labelledby={`${sectionId(index)}-title`}
                  className="scroll-mt-[calc(60px+var(--safe-top)+16px)]"
                >
                  <h2 id={`${sectionId(index)}-title`} className="type-section text-balance-th text-fg">
                    {section.title}
                  </h2>
                  {section.body ? (
                    <p className="mt-2 text-base leading-[1.7] text-fg">{thaiCopy(section.body)}</p>
                  ) : null}
                  {section.items?.length ? (
                    <ul className="mt-2 grid list-disc gap-2 pl-5 text-base leading-[1.7] text-fg marker:text-brand-fg">
                      {section.items.map((item) => (
                        <li key={item}>{thaiCopy(item)}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <footer className="mt-12 grid gap-3 sm:grid-cols-2">
              <a
                href={HELP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-start gap-3 rounded-(--radius-card) border p-4 outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring",
                  cardTapClass,
                )}
              >
                <IconTile icon={MessageCircle} tone="blue" />
                <span className="min-w-0 flex-1">
                  <span className="block type-card text-fg">{t("app.legalContactTitle")}</span>
                  <span className="mt-0.5 block type-body-s text-fg-muted">{thaiLabel(t("app.legalContactBody"))}</span>
                  <span className="mt-2 inline-flex items-center gap-1 type-label font-semibold text-brand-fg">
                    {t("app.legalContactAction")}
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </span>
                </span>
              </a>
              <Link
                href={related.href}
                className={cn(
                  "flex items-start gap-3 rounded-(--radius-card) border p-4 outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring",
                  cardTapClass,
                )}
              >
                <IconTile icon={FileText} tone="neutral" />
                <span className="min-w-0 flex-1">
                  <span className="block type-card text-fg">{t("app.legalRelatedTitle")}</span>
                  <span className="mt-0.5 block type-body-s text-fg-muted">{related.label}</span>
                </span>
                <ChevronRight aria-hidden="true" className="mt-2.5 size-5 shrink-0 text-fg-subtle" />
              </Link>
            </footer>
          </article>
        </main>
      </div>
    </div>
  );
}
