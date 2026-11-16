import type { ReactNode, Ref } from "react";
import { AlertCircle, Check, CircleHelp } from "lucide-react";
import { IconTile, Surface } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { keepThaiWords } from "../../payment/_components/ThaiText";
import { GUARDIAN_RELATIONS } from "../_lib/form";

/**
 * Numbered step card ("ขั้นที่ 1") so the form reads as 3 short steps. The
 * number disc turns into a check once the step is filled in (icon + the step
 * word stay, so it is never colour alone).
 */
export function StepCard({
  step,
  done = false,
  children,
  className,
}: {
  step: number;
  /** The step's field is filled in: the disc shows a check. */
  done?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Surface as="section" padding="lg" className={cn("flex flex-col gap-4", className)}>
      <p className="flex items-center gap-2.5 text-sm leading-[1.5] font-semibold text-fg-muted">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] leading-none font-semibold tabular-nums transition-colors duration-[var(--duration-fast)]",
            done ? "bg-brand-solid text-on-brand" : "bg-brand-soft text-brand-soft-fg shadow-[inset_0_0_0_1.5px_var(--brand-soft-border)]",
          )}
        >
          {done ? <Check className="size-[18px]" strokeWidth={3} /> : step}
        </span>
        {t("guardian.stepPrefix")} {step}
      </p>
      {children}
    </Surface>
  );
}

interface RelationPickerProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** For focusing the first option after a failed submit. */
  firstOptionRef?: Ref<HTMLInputElement>;
}

/**
 * 2×2 selectable tiles (native radios: arrow keys and screen readers work as
 * usual). Tappable, so they carry the clay ledge; selected = 2px jade border,
 * soft jade fill and a check badge (not colour alone).
 */
export function RelationPicker({ value, onChange, error, firstOptionRef }: RelationPickerProps) {
  const errorId = "guardian-relation-error";
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2.5 p-0 font-heading text-[15px] leading-[1.4] font-semibold text-fg">
        {t("guardian.relationLabel")}
        <span aria-hidden="true" className="ml-0.5 text-danger-fg">
          *
        </span>
      </legend>
      <div className="grid grid-cols-2 gap-3">
        {GUARDIAN_RELATIONS.map((relation, index) => {
          const checked = value === relation.value;
          return (
            <label
              key={relation.value}
              className={cn(
                "relative flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-ctl)] border-2 px-3.5 text-base leading-[1.5] font-semibold [-webkit-tap-highlight-color:transparent]",
                "transition-[translate,box-shadow,background-color,border-color] duration-[var(--duration-press)] ease-[var(--ease-out)]",
                // The native radio is visually hidden: draw the 3px focus ring on the card.
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-focus-ring",
                checked
                  ? "border-brand-fg bg-brand-soft text-brand-soft-fg shadow-[0_2px_0_var(--brand-soft-border)]"
                  : "border-field-border bg-surface text-fg shadow-[0_var(--ledge-sm)_0_var(--clay-ledge)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--clay-ledge)]",
                error && !checked && "border-danger-fg",
              )}
            >
              <input
                ref={index === 0 ? firstOptionRef : undefined}
                type="radio"
                name="guardian-relation"
                value={relation.value}
                checked={checked}
                onChange={() => onChange(relation.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  checked ? "border-brand-solid bg-brand-solid text-on-brand" : "border-field-border bg-surface",
                )}
              >
                {checked ? <Check className="size-3.5" strokeWidth={3.2} /> : null}
              </span>
              <span className="min-w-0">{t(relation.labelKey)}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="mt-2.5 flex items-start gap-1.5 text-sm leading-[1.6] text-danger-fg">
          <AlertCircle aria-hidden="true" className="mt-[3px] size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}

interface AgreementCheckProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown under the box while it is not ticked. */
  showHint: boolean;
  /** The student tried to submit without ticking. */
  invalid: boolean;
}

/** Big tappable confirmation row (the whole row toggles the checkbox). */
export function AgreementCheck({ checked, onChange, showHint, invalid }: AgreementCheckProps) {
  const hintId = "guardian-agreement-hint";
  return (
    <div className="flex flex-col gap-2">
      <label
        className={cn(
          "flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-tile)] border-2 p-3.5 transition-colors duration-150",
          checked ? "border-brand-fg bg-brand-soft" : invalid ? "border-danger-fg bg-surface" : "border-field-border bg-surface-muted",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={showHint ? hintId : undefined}
          aria-invalid={invalid || undefined}
          className="mt-0.5 size-6 shrink-0 cursor-pointer accent-brand-solid"
        />
        <span className="text-[15px] leading-[1.65] text-pretty text-fg">{keepThaiWords(t("guardian.agreement"))}</span>
      </label>
      {showHint ? (
        <p
          id={hintId}
          className={cn("flex items-start gap-1.5 px-1 text-sm leading-[1.6]", invalid ? "text-danger-fg" : "text-fg-muted")}
        >
          {invalid ? <AlertCircle aria-hidden="true" className="mt-[3px] size-4 shrink-0" /> : null}
          <span>{t("guardian.agreementHint")}</span>
        </p>
      ) : null}
    </div>
  );
}

/** The two FAQ answers under the form. */
export function GuardianFaq() {
  return (
    <section aria-labelledby="guardian-faq-title" className="flex flex-col gap-3 pt-2">
      <h2 id="guardian-faq-title" className="t-section text-fg">
        {t("guardian.faqTitle")}
      </h2>
      <Surface padding="none" className="overflow-hidden">
        {[
          { title: t("guardian.faqWhyTitle"), description: t("guardian.faqWhyDescription") },
          { title: t("guardian.faqEditTitle"), description: t("guardian.faqEditDescription") },
        ].map((item, index) => (
          <div key={item.title} className={cn("flex gap-3.5 px-4 py-4", index > 0 && "border-t-[1.5px] border-hairline")}>
            <IconTile icon={CircleHelp} tone="blue" size="sm" />
            <div className="min-w-0">
              {/* Static copy: balanced heading, no compound ("ผู้ / ปกครอง") split across lines. */}
              <h3 className="text-base leading-[1.5] font-semibold text-balance text-fg">{keepThaiWords(item.title)}</h3>
              <p className="mt-1 text-sm leading-[1.65] text-pretty text-fg-muted">{keepThaiWords(item.description)}</p>
            </div>
          </div>
        ))}
      </Surface>
    </section>
  );
}
