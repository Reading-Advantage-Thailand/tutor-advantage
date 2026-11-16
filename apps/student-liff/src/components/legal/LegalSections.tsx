import type { ReactNode } from "react";
import { businessContact } from "@/lib/businessContact";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";

/** One section of a legal document (see studentLegalCopy in @/lib/content/legal). */
export interface LegalSection {
  readonly title: string;
  readonly body?: string;
  readonly items?: readonly string[];
}

export interface LegalSectionsProps {
  sections: readonly LegalSection[];
  /** Heading level for section titles (h2 on a document page, deeper when nested). */
  headingLevel?: "h2" | "h3" | "h4";
  /**
   * plain (default): one flowing column (inside another card, e.g. the consent gate).
   * cards: each section in its own card with its number in a tile (document pages).
   */
  variant?: "plain" | "cards";
  className?: string;
}

/** "1. ข้อมูลที่เราจัดเก็บ" → ["1", "ข้อมูลที่เราจัดเก็บ"]; titles without a number stay whole. */
function splitNumber(title: string): [string | null, string] {
  const match = /^(\d+)\.\s*(.+)$/.exec(title);
  return match ? [match[1], match[2]] : [null, title];
}

// The support address is 253px at 16px, wider than a list item on a 320px phone.
// Same break as BusinessContactCard: whole where it fits, else it wraps after "@"
// ("support@" / "reading-advantage.com"); the domain never breaks.
const emailAt = businessContact.email.indexOf("@") + 1;

/** Thai copy with no listed word split across lines (thaiCopy); the support address may wrap after "@". */
function legalCopy(text: string): ReactNode {
  const start = text.indexOf(businessContact.email);
  if (start < 0) return thaiCopy(text);
  return (
    <>
      {keepThaiWords(text.slice(0, start))}
      <span className="inline-block">
        {businessContact.email.slice(0, emailAt)}
        <wbr />
        <span className="whitespace-nowrap">{businessContact.email.slice(emailAt)}</span>
      </span>
      {thaiCopy(text.slice(start + businessContact.email.length))}
    </>
  );
}

function SectionBody({ section }: { section: LegalSection }) {
  return (
    <>
      {section.body ? <p className="mt-2 text-base leading-[1.7] text-fg">{legalCopy(section.body)}</p> : null}
      {section.items?.length ? (
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-base leading-[1.7] text-fg marker:text-fg-subtle">
          {section.items.map((item) => (
            <li key={item}>{legalCopy(item)}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/**
 * Readable legal text: 16px body at a relaxed Thai line height (1.7), section
 * titles, bulleted lists. Titles, body and items go through the Thai line-break
 * helper. Server-compatible (also rendered inside the consent gate).
 */
export function LegalSections({ sections, headingLevel: Heading = "h2", variant = "plain", className }: LegalSectionsProps) {
  if (variant === "cards") {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {sections.map((section) => {
          const [number, title] = splitNumber(section.title);
          return (
            <section
              key={section.title}
              className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-[18px] shadow-[var(--shadow-card)]"
            >
              <Heading className="flex items-start gap-3 font-heading text-lg leading-[1.4] font-semibold text-fg">
                {number ? (
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-brand-soft font-heading text-base leading-none font-bold text-brand-soft-fg"
                  >
                    {number}
                  </span>
                ) : null}
                {/* The number stays in the accessible name: the tile is hidden, the text is not. */}
                <span className="min-w-0 pt-1 text-balance">
                  {number ? <span className="sr-only">{number}. </span> : null}
                  {keepThaiWords(title)}
                </span>
              </Heading>
              <SectionBody section={section} />
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-7", className)}>
      {sections.map((section) => (
        <section key={section.title}>
          <Heading className="text-[17px] leading-[1.5] font-bold text-fg">{keepThaiWords(section.title)}</Heading>
          <SectionBody section={section} />
        </section>
      ))}
    </div>
  );
}
