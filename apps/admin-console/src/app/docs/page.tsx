import { FileText, MessageSquare, ShieldCheck, Workflow, type LucideIcon } from "lucide-react";
import { IconTile } from "@/components/app/Atoms";
import { Page, PageHeader } from "@/components/app/Page";
import { Surface } from "@/components/app/Surface";
import { t } from "@/lib/i18n";
import { adminDocsCopy } from "@/locales/th/docsCopy";
import "@/locales/th/docs";

/** Static help hub: server-rendered, no client JS beyond the shell. */
const SECTION_ICONS: Record<string, LucideIcon> = { operations: Workflow, risk: ShieldCheck, system: FileText };
const SUPPORT_URL = "https://lin.ee/R7Dccj9";

export default function DocsPage() {
  const sections = adminDocsCopy.sections;
  return (
    <Page>
      <PageHeader title={t("docs.pageTitle")} description={t("docs.pageDescription")} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        {/* Table of contents: a compact card on phones, sticky column on desktop. */}
        <nav aria-label={t("docs.contents")} className="lg:sticky lg:top-6">
          <Surface padding="md">
            <h2 className="mb-2 text-sm font-semibold text-fg-muted">{t("docs.contents")}</h2>
            <ol className="flex flex-col gap-3">
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-sm font-semibold text-fg hover:text-brand-fg">
                    {section.title}
                  </a>
                  <ul className="mt-1 flex flex-col gap-0.5 border-l border-hairline pl-3">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className="block py-0.5 text-[0.8125rem] leading-snug text-fg-muted hover:text-fg"
                        >
                          {item.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </Surface>
        </nav>

        <div className="flex min-w-0 flex-col gap-10">
          {sections.map((section) => {
            const Icon = SECTION_ICONS[section.id] ?? FileText;
            return (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <IconTile icon={Icon} tone="brand" size="md" />
                  <div className="min-w-0">
                    <h2 id={`${section.id}-title`} className="text-lg font-semibold text-fg">
                      {section.title}
                    </h2>
                    <p className="mt-0.5 text-sm text-fg-muted">{section.description}</p>
                  </div>
                </div>
                {section.items.map((item) => (
                  <Surface key={item.id} as="article" padding="lg" id={item.id} className="scroll-mt-24">
                    <h3 className="text-base font-semibold text-fg">{item.title}</h3>
                    <div className="mt-3 flex max-w-[70ch] flex-col gap-3 text-[0.9375rem] leading-7 text-fg">
                      {item.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </Surface>
                ))}
              </section>
            );
          })}

          <Surface tone="muted" padding="lg">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-fg">{t("docs.helpTitle")}</h2>
                <p className="mt-1 text-sm text-fg-muted">{t("docs.helpDescription")}</p>
              </div>
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-solid px-4 text-sm font-medium text-on-brand hover:bg-brand-solid-pressed"
              >
                <MessageSquare aria-hidden="true" className="size-4" />
                {t("docs.supportCta")}
              </a>
            </div>
          </Surface>
        </div>
      </div>
    </Page>
  );
}
