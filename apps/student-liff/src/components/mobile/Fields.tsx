"use client";

import { forwardRef, useId, useRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { AlertCircle, Search, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// components.md §8: 52px, radius 16, card fill, 2px field border (≥ 3.48:1), 16px
// text. Focus = jade border + the 3px blue outline; error = danger border.
const fieldBase =
  "w-full rounded-[var(--radius-field)] border-2 border-field-border bg-surface px-4 text-base text-fg transition-[border-color] duration-[var(--duration-fast)] placeholder:text-fg-subtle " +
  "focus:border-brand-fg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring " +
  "read-only:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-45 " +
  "aria-[invalid=true]:border-danger-solid";

// Date and time inputs: once Tab moves past the first day / month / year
// segment, Edge (Chromium) no longer matches :focus or :focus-visible on the
// input (the segment inside its shadow root has focus), so the ring vanished.
// :focus-within still matches the input there, so these keep the jade border
// and the ring while focus is anywhere inside the field.
const DATE_LIKE_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);
const dateFocusRing =
  "focus-within:border-brand-fg focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring";

interface FieldChromeProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

function FieldChrome({ id, label, hint, error, required, className, children }: FieldChromeProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="font-heading text-[15px] leading-[1.4] font-semibold text-fg">
          {label}
          {required ? <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm leading-[1.6] text-danger-fg">
          <AlertCircle aria-hidden="true" className="mt-[2px] size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm leading-[1.6] text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error: ReactNode, hint: ReactNode, extra?: string) {
  const ids = [error ? `${id}-error` : hint ? `${id}-hint` : null, extra].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/* ─── TextField ─────────────────────────────────────────────────────────── */

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: ReactNode;
  hint?: ReactNode;
  /** Error message; also sets aria-invalid and the red border. */
  error?: ReactNode;
  /** Class for the wrapper (label + input + message). */
  className?: string;
  /** Class for the <input> itself. */
  inputClassName?: string;
}

/** Labelled 52px text input (16px text — no iOS zoom) with hint/error slot. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, inputClassName, id: idProp, required, "aria-describedby": ariaDescribedBy, ...inputProps },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldChrome id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint, ariaDescribedBy)}
        className={cn(
          fieldBase,
          "h-[52px]",
          inputProps.type && DATE_LIKE_TYPES.has(inputProps.type) && dateFocusRing,
          inputClassName,
        )}
        {...inputProps}
      />
    </FieldChrome>
  );
});

/* ─── TextArea ──────────────────────────────────────────────────────────── */

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  textareaClassName?: string;
}

/** Multi-line input: 16px text, min-height 120px, optional label/hint/error. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, className, textareaClassName, id: idProp, required, "aria-describedby": ariaDescribedBy, ...textareaProps },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldChrome id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint, ariaDescribedBy)}
        className={cn(fieldBase, "min-h-[120px] resize-y py-3 leading-[1.65]", textareaClassName)}
        {...textareaProps}
      />
    </FieldChrome>
  );
});

/* ─── SearchField ───────────────────────────────────────────────────────── */

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "size"> {
  value: string;
  /** Called with the new text (not the event). */
  onChange: (value: string) => void;
  /** Defaults to t("common.searchPlaceholder"). */
  placeholder?: string;
  /** Called by the clear (×) button; defaults to onChange(""). */
  onClear?: () => void;
  /** Accessible name; defaults to t("common.search"). */
  "aria-label"?: string;
  className?: string;
}

/**
 * 52px search input (same field look): leading search icon 20, clear button
 * with a 44px hit area, `type="search"` and `enterKeyHint="search"` (keyboard
 * shows a search key). 16px text.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  onClear,
  className,
  onKeyDown,
  ...rest
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div role="search" className={cn("relative", className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-subtle" />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder ?? t("common.searchPlaceholder")}
        aria-label={rest["aria-label"] ?? t("common.search")}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Close the on-screen keyboard on "search" like a native search bar.
          if (event.key === "Enter") event.currentTarget.blur();
          onKeyDown?.(event);
        }}
        className={cn(
          fieldBase,
          "h-[52px] pr-12 pl-12 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
        )}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          aria-label={t("common.clearSearch")}
          onClick={() => {
            if (onClear) onClear();
            else onChange("");
            inputRef.current?.focus();
          }}
          className="pressable absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-fg-muted active:bg-press"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-fill-muted">
            <X aria-hidden="true" className="size-3.5" strokeWidth={2.6} />
          </span>
        </button>
      ) : null}
    </div>
  );
}
