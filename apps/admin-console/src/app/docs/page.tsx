import { ArrowUp, FileText, MessageSquare, ShieldCheck, Workflow, type LucideIcon } from "lucide-react";
import { IconTile } from "@/components/app/Atoms";
import { Page, PageHeader } from "@/components/app/Page";
import { Surface } from "@/components/app/Surface";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import { adminDocsCopy } from "@/locales/th/docsCopy";
import { DocsToc, type TocSection } from "./DocsToc";
import "@/locales/th/docs";

/**
 * Static help hub (patterns.md A6): a sticky 240px table of contents beside
 * the article (max 720, body 15/1.7). Server-rendered; the only client code is
 * the TOC's "current topic" marker.
 */
const SECTION_ICONS: Record<string, LucideIcon> = { operations: Workflow, risk: ShieldCheck, system: FileText };
const SUPPORT_URL = "https://lin.ee/R7Dccj9";

export default function DocsPage() {
  const sections = adminDocsCopy.sections;
  const toc: TocSection[] = sections.map((section) => ({
    id: section.id,
    title: section.title,
    items: section.items.map((item) => ({ id: item.id, name: item.name })),
  }));
  return (
    <Page>
      <PageHeader title={t("docs.pageTitle")} description={t("docs.pageDescription")} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[240px_minmax(0,720px)] lg:gap-10">
        <DocsToc sections={toc} variant="sticky" />

        <div className="flex min-w-0 flex-col gap-5">
          <DocsToc sections={toc} variant="disclosure" />

          {sections.map((section) => {
            const Icon = SECTION_ICONS[section.id] ?? FileText;
            return (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="card overflow-hidden">
                <header className="flex items-start gap-3 border-b border-hairline px-5 py-4 sm:px-7 sm:py-5">
                  <IconTile icon={Icon} tone="brand" size="md" />
                  <div className="min-w-0">
                    <h2 id={`${section.id}-title`} className="text-lg leading-[1.45] font-semibold text-fg text-balance-th">
                      {keepThaiWords(section.title)}
                    </h2>
                    <p className="mt-0.5 text-sm text-fg-muted">{thaiCopy(section.description)}</p>
                  </div>
                </header>
                {section.items.map((item, index) => (
                  <article
                    key={item.id}
                    id={item.id}
                    aria-labelledby={`${item.id}-title`}
                    className={index > 0 ? "border-t border-hairline px-5 py-5 sm:px-7 sm:py-6" : "px-5 py-5 sm:px-7 sm:py-6"}
                  >
                    <h3 id={`${item.id}-title`} className="text-base leading-normal font-semibold text-fg text-balance-th">
                      {keepThaiWords(item.title)}
                    </h3>
                    <div className="mt-2.5 flex flex-col gap-3 text-base leading-[1.7] text-fg lg:text-[0.9375rem]">
                      {item.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{thaiCopy(paragraph)}</p>
                      ))}
                    </div>
                  </article>
                ))}
                <div className="flex border-t border-hairline px-3 py-1.5 lg:hidden">
                  <a href="#main-content" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    <ArrowUp aria-hidden="true" />
                    {t("docs.backToTop")}
                  </a>
                </div>
              </section>
            );
          })}

          <Surface as="section" tone="muted" padding="lg" aria-labelledby="docs-help-title" className="sm:px-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 id="docs-help-title" className="text-base leading-normal font-semibold text-fg">
                  {t("docs.helpTitle")}
                </h2>
                <p className="mt-1 text-sm text-fg-muted">{t("docs.helpDescription")}</p>
              </div>
              <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "lg", className: "shrink-0" })}>
                <MessageSquare aria-hidden="true" />
                {t("docs.supportCta")}
              </a>
            </div>
          </Surface>
        </div>
      </div>
    </Page>
  );
}
