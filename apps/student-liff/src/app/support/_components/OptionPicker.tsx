import type { Ref } from "react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickerOption {
  value: string;
  label: string;
}

interface OptionPickerProps {
  /** Radio group name (unique per form). */
  name: string;
  legend: string;
  options: readonly PickerOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** For focusing the first option after a failed submit. */
  firstOptionRef?: Ref<HTMLInputElement>;
}

/**
 * Single-column radio cards (native radios: arrow keys and screen readers work
 * as usual). Same look as the guardian RelationPicker, one option per row so
 * long Thai labels never wrap awkwardly.
 */
export function OptionPicker({ name, legend, options, value, onChange, error, firstOptionRef }: OptionPickerProps) {
  const errorId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 p-0 text-sm leading-[1.5] font-semibold text-fg">{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((option, index) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value || "none"}
              className={cn(
                "pressable flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border bg-surface px-3 py-2 text-[15px] leading-[1.5] font-semibold transition-colors duration-150",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-vivid/30",
                checked ? "border-brand-vivid bg-brand-soft text-brand-fg" : "border-field-border text-fg active:bg-press",
                error && !checked && "border-danger-fg",
              )}
            >
              <input
                ref={index === 0 ? firstOptionRef : undefined}
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
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
              <span className="min-w-0">{option.label}</span>
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
