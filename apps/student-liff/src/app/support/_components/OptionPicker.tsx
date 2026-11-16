import type { Ref } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Check } from "lucide-react";
import { IconTile, type IconTileTone } from "@/components/mobile";
import { cn } from "@/lib/utils";

export interface PickerOption {
  value: string;
  label: string;
  /** Tile icon (layout="tiles"). */
  icon?: LucideIcon;
  /** Tile tone (layout="tiles"). */
  tone?: IconTileTone;
  /**
   * Authored line-break units for a tile label (layout="tiles"): each piece
   * stays whole. Used only when they join to exactly `label`.
   */
  segments?: readonly string[];
}

interface OptionPickerProps {
  /** Radio group name (unique per form). */
  name: string;
  legend: string;
  options: readonly PickerOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Marks the group required (red * in the legend, aria-required on the group). */
  required?: boolean;
  /** For focusing the first option after a failed submit. */
  firstOptionRef?: Ref<HTMLInputElement>;
  /**
   * list (default): one option per row, so long labels (class names) never wrap awkwardly.
   * tiles: 2-column tappable tone tiles with a clay ledge (ticket categories, patterns.md S13).
   */
  layout?: "list" | "tiles";
}

/** Phrases up to this many characters fit one line of a 2-column tile at 320px. */
const SHORT_PHRASE = 14;

/**
 * Tile label. Authored segments win (patterns.md "Thai text": tight grids get
 * authored breaks): each is kept whole (inline-block) and lines break only
 * between them; the text, and so the radio's accessible name, is unchanged.
 * Without them a "/"-separated label ("คลาสเรียน/ตารางเรียน") prefers to break
 * after the slash. Short phrases are kept whole (inline-block), so Thai word
 * segmentation does not split them mid-way; a long phrase wraps normally.
 */
function TileLabel({ label, segments }: { label: string; segments?: readonly string[] }) {
  if (segments && segments.length > 1 && segments.join("") === label) {
    return (
      <span className="min-w-0 break-words">
        {segments.map((segment, index) => (
          <span key={index} className="inline-block max-w-full">
            {segment}
          </span>
        ))}
      </span>
    );
  }
  const parts = label.split("/");
  if (parts.length < 2) return <span className="min-w-0 break-words">{label}</span>;
  return (
    <span className="min-w-0 break-words">
      {parts.map((part, index) => {
        const text = index < parts.length - 1 ? `${part}/` : part;
        return part.length <= SHORT_PHRASE ? (
          <span key={index} className="inline-block">
            {text}
          </span>
        ) : (
          <span key={index}>{text}</span>
        );
      })}
    </span>
  );
}

/**
 * Radio cards built on native radios (arrow keys and screen readers work as
 * usual; the input is visually hidden and the card draws the 3px focus ring).
 * Selected = 2px jade border + soft jade fill + a check badge (not colour alone).
 */
export function OptionPicker({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  required,
  firstOptionRef,
  layout = "list",
}: OptionPickerProps) {
  const errorId = `${name}-error`;
  const legendId = `${name}-legend`;
  const tiles = layout === "tiles";
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="m-0 min-w-0 border-0 p-0">
      <legend id={legendId} className="mb-3 p-0 font-heading text-[15px] leading-[1.4] font-semibold text-fg">
        {legend}
        {required ? <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span> : null}
      </legend>
      <div
        className={tiles ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3" : "flex flex-col gap-2"}
        role={required ? "radiogroup" : undefined}
        aria-labelledby={required ? legendId : undefined}
        aria-required={required || undefined}
      >
        {options.map((option, index) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value || "none"}
              className={cn(
                "relative flex cursor-pointer border-2 [-webkit-tap-highlight-color:transparent]",
                "transition-[translate,box-shadow,background-color,border-color] duration-[var(--duration-press)] ease-[var(--ease-out)]",
                // The native radio is visually hidden: draw the 3px blue focus ring on the card.
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring has-[:focus-visible]:outline-solid",
                tiles
                  ? // Tappable tile: rim + 3px clay ledge that it presses down onto.
                    "min-h-[92px] flex-col items-start gap-2 rounded-[20px] p-3 text-[15px] leading-[1.6] font-semibold shadow-[0_var(--ledge-sm)_0_var(--clay-ledge)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--clay-ledge)]"
                  : "min-h-[52px] items-center gap-3 rounded-[var(--radius-field)] px-3.5 py-2.5 text-base leading-[1.6] font-semibold",
                checked
                  ? "border-brand-fg bg-brand-soft text-brand-soft-fg"
                  : cn("bg-surface text-fg active:bg-press", tiles ? "border-clay-rim" : "border-field-border"),
                error && !checked && "border-danger-solid",
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
              {tiles ? (
                <>
                  {option.icon ? <IconTile icon={option.icon} tone={option.tone ?? "neutral"} size="sm" className={checked ? "bg-surface" : undefined} /> : null}
                  <TileLabel label={option.label} segments={option.segments} />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full border-2",
                      checked ? "border-brand-solid bg-brand-solid text-on-brand" : "border-field-border bg-surface",
                    )}
                  >
                    {checked ? <Check className="size-3.5" strokeWidth={3.2} /> : null}
                  </span>
                </>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                      checked ? "border-brand-solid bg-brand-solid text-on-brand" : "border-field-border",
                    )}
                  >
                    {checked ? <Check className="size-3.5" strokeWidth={3.2} /> : null}
                  </span>
                  <span className="min-w-0 break-words">{option.label}</span>
                </>
              )}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="mt-2.5 flex items-start gap-1.5 text-sm leading-[1.6] text-danger-fg">
          <AlertCircle aria-hidden="true" className="mt-[2px] size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}
