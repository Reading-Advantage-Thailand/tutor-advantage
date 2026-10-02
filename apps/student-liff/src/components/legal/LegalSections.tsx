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
  className?: string;
}

/**
 * Readable legal text: 16px body at a relaxed Thai line height, bold section
 * titles, bulleted lists. Server-compatible (also rendered inside the consent gate).
 */
export function LegalSections({ sections, headingLevel: Heading = "h2", className }: LegalSectionsProps) {
  return (
    <div className={cn("flex flex-col gap-7", className)}>
      {sections.map((section) => (
        <section key={section.title}>
          <Heading className="text-[17px] leading-[1.5] font-bold text-fg">{section.title}</Heading>
          {section.body ? <p className="mt-2 text-base leading-[1.7] text-fg">{section.body}</p> : null}
          {section.items?.length ? (
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-base leading-[1.7] text-fg marker:text-fg-subtle">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
