"use client";

import { forwardRef, useId, useRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { AlertCircle, Search, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-xl border border-field-border bg-surface px-4 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-subtle " +
  "focus:border-brand-vivid focus:ring-3 focus:ring-brand-vivid/20 focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-[invalid=true]:border-danger-fg aria-[invalid=true]:focus:ring-danger-fg/20";

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
        <label htmlFor={id} className="text-sm leading-[1.5] font-semibold text-fg">
          {label}
          {required ? <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-[13px] leading-[1.5] text-danger-fg">
          <AlertCircle aria-hidden="true" className="mt-[3px] size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] leading-[1.5] text-fg-muted">
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

/** Labelled 48px text input (16px text — no iOS zoom) with hint/error slot. */
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
        className={cn(fieldBase, "h-12", inputClassName)}
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
        className={cn(fieldBase, "min-h-[120px] resize-y py-3 leading-[1.6]", textareaClassName)}
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
 * 44px rounded search input: leading icon, clear button, `type="search"` and
 * `enterKeyHint="search"` (keyboard shows a search key). 16px text.
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
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-fg-subtle" />
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
          "h-11 rounded-full border-hairline bg-surface pr-11 pl-11 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
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
          className="pressable absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-fg-subtle active:bg-press"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-fill-muted">
            <X aria-hidden="true" className="size-3.5" strokeWidth={2.6} />
          </span>
        </button>
      ) : null}
    </div>
  );
}
