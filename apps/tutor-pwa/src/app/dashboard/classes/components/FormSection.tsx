import { forwardRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconTile, type TileTone } from "@/components/app";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";

export interface FormSectionProps {
  /** id of the h2 (the section is labelled by it). */
  id: string;
  icon: LucideIcon;
  tone?: TileTone;
  title: ReactNode;
  /** One helper line under the title (14 --text-secondary). */
  description?: ReactNode;
  /** Shows the required "*" after the title. */
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A fieldset card of the class forms (patterns.md T4): the clay-rimmed card
 * (no ledge: it is a container) with a tone tile, a section title (Noto 600
 * 18, an h2 under the page h1) and a helper line, then the fields. The ref
 * goes on the card so a form can scroll a section into view.
 */
export const FormSection = forwardRef<HTMLElement, FormSectionProps>(function FormSection(
  { id, icon, tone = "brand", title, description, required, children, className },
  ref,
) {
  return (
    <section
      ref={ref}
      aria-labelledby={id}
      className={cn("ds-card min-w-0 scroll-mt-24 p-4 sm:p-5 md:p-6", className)}
    >
      <div className="mb-4 flex items-start gap-3 md:mb-5">
        <IconTile icon={icon} tone={tone} />
        <div className="min-w-0 flex-1 pt-px">
          <h2 id={id} className="type-section text-fg">
            {thaiLabel(title)}
            {required ? (
              <span className="ml-0.5 text-danger-fg" aria-hidden="true">
                *
              </span>
            ) : null}
          </h2>
          {description ? <p className="mt-0.5 type-body-s text-fg-muted">{thaiCopy(description)}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
});
