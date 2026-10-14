import type { ReactNode, Ref } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Surface } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { GUARDIAN_RELATIONS } from "../_lib/form";

/** Numbered step card ("ขั้นที่ 1") so the form reads as 3 short steps. */
export function StepCard({ step, children, className }: { step: number; children: ReactNode; className?: string }) {
  return (
    <Surface as="section" className={cn("flex flex-col gap-3", className)}>
      <p className="self-start rounded-full bg-brand-soft px-3 py-0.5 text-[13px] leading-[1.6] font-bold text-brand-fg">
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

/** 2×2 radio cards (native radios: arrow keys and screen readers work as usual). */
export function RelationPicker({ value, onChange, error, firstOptionRef }: RelationPickerProps) {
  const errorId = "guardian-relation-error";
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 p-0 text-sm leading-[1.5] font-semibold text-fg">{t("guardian.relationLabel")}</legend>
      <div className="grid grid-cols-2 gap-2">
        {GUARDIAN_RELATIONS.map((relation, index) => {
          const checked = value === relation.value;
          return (
            <label
              key={relation.value}
              className={cn(
                "pressable flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border bg-surface px-3 text-[15px] leading-[1.5] font-semibold transition-colors duration-150",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-vivid/30",
                checked ? "border-brand-vivid bg-brand-soft text-brand-fg" : "border-field-border text-fg active:bg-press",
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
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  checked ? "border-brand-vivid bg-brand-vivid text-white" : "border-field-border",
                )}
              >
                {checked ? <Check className="size-3" strokeWidth={3.2} /> : null}
              </span>
              {t(relation.labelKey)}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="mt-2 flex items-start gap-1 text-[13px] leading-[1.5] text-danger-fg">
          <AlertCircle aria-hidden="true" className="mt-[3px] size-3.5 shrink-0" />
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
          "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-150",
          checked ? "border-brand-vivid bg-brand-soft" : invalid ? "border-danger-fg" : "border-field-border",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={showHint ? hintId : undefined}
          aria-invalid={invalid || undefined}
          className="mt-0.5 size-6 shrink-0 cursor-pointer accent-brand-vivid"
        />
        <span className="text-sm leading-[1.6] text-fg">{t("guardian.agreement")}</span>
      </label>
      {showHint ? (
        <p id={hintId} className={cn("px-1 text-[13px] leading-[1.5]", invalid ? "text-danger-fg" : "text-fg-muted")}>
          {t("guardian.agreementHint")}
        </p>
      ) : null}
    </div>
  );
}

/** The two FAQ answers under the form. */
export function GuardianFaq() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[15px] leading-[1.5] font-bold text-fg">{t("guardian.faqTitle")}</h2>
      <Surface className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm leading-[1.5] font-semibold text-fg">{t("guardian.faqWhyTitle")}</h3>
          <p className="mt-1 text-[13px] leading-[1.6] text-fg-muted">{t("guardian.faqWhyDescription")}</p>
        </div>
        <div className="h-px bg-hairline" aria-hidden="true" />
        <div>
          <h3 className="text-sm leading-[1.5] font-semibold text-fg">{t("guardian.faqEditTitle")}</h3>
          <p className="mt-1 text-[13px] leading-[1.6] text-fg-muted">{t("guardian.faqEditDescription")}</p>
        </div>
      </Surface>
    </section>
  );
}
