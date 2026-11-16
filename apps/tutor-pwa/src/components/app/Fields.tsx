"use client";

import {
  forwardRef,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AlertCircle, ChevronDown, Search, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { fieldControlClass } from "./constants";


/* ─── Field (label / hint / error chrome) ─────────────────────────────── */

export interface FieldProps {
  /** id of the control; generated when omitted (pass it to your control). */
  id?: string;
  label?: ReactNode;
  /** Helper text under the control (hidden while an error shows). */
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Shows "(ไม่บังคับ)" after the label. */
  optional?: boolean;
  /**
   * Hide the label visually; it stays the control's accessible name. For
   * compact composers (a chat or ticket reply box) whose placeholder and
   * context already say what to type.
   */
  hideLabel?: boolean;
  className?: string;
  /** The control. Render-prop form receives the ids to wire up aria. */
  children: ReactNode | ((ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode);
}

/**
 * Label + control + hint/error, vertically stacked (hint and error 14/1.6).
 * Use the render-prop form for custom controls:
 * <Field label="วันที่" error={err}>{({ id, describedBy, invalid }) => <DatePicker id={id} … />}</Field>
 */
export function Field({ id: idProp, label, hint, error, required, optional, hideLabel, className, children }: FieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className={cn("text-sm font-medium text-fg", hideLabel && "sr-only")}>
          {label}
          {required ? (
            <span className="ml-0.5 text-danger-fg" aria-hidden="true">
              *
            </span>
          ) : null}
          {optional ? <span className="ml-1 font-normal text-fg-subtle">({t("shell.optional")})</span> : null}
        </label>
      ) : null}
      {typeof children === "function" ? children({ id, describedBy, invalid: Boolean(error) }) : children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm leading-[1.6] text-fg-muted">
          {thaiCopy(hint)}
        </p>
      ) : null}
      {/* Always mounted so screen readers announce an error when it appears;
          the negative margin cancels the flex gap while it is empty. */}
      <div aria-live="polite" className="empty:-mt-1.5">
        {error ? (
          <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm leading-[1.6] text-danger-fg">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

type FieldChromeProps = Pick<FieldProps, "label" | "hint" | "error" | "optional" | "hideLabel"> & {
  /** Classes for the outer wrapper (the control gets `className`). */
  containerClassName?: string;
};

/* ─── TextField ───────────────────────────────────────────────────────── */

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement>, FieldChromeProps {
  /** Icon/text inside the left edge (e.g. "฿"). */
  startAddon?: ReactNode;
  /** Icon/text inside the right edge (e.g. "บาท"). */
  endAddon?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, hint, error, optional, hideLabel, required, containerClassName, className, startAddon, endAddon, ...props },
  ref,
) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} optional={optional} hideLabel={hideLabel} className={containerClassName}>
      {({ id: fieldId, describedBy, invalid }) => (
        <div className="relative">
          {startAddon ? (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-fg-subtle">{startAddon}</span>
          ) : null}
          <input
            ref={ref}
            id={fieldId}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(fieldControlClass, "h-11 pointer-coarse:h-12", startAddon && "pl-9", endAddon && "pr-12", className)}
            {...props}
          />
          {endAddon ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-fg-subtle">{endAddon}</span>
          ) : null}
        </div>
      )}
    </Field>
  );
});

/* ─── TextAreaField ───────────────────────────────────────────────────── */

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChromeProps {}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { id, label, hint, error, optional, hideLabel, required, containerClassName, className, rows = 4, ...props },
  ref,
) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} optional={optional} hideLabel={hideLabel} className={containerClassName}>
      {({ id: fieldId, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(fieldControlClass, "min-h-20 resize-y py-2 leading-relaxed", className)}
          {...props}
        />
      )}
    </Field>
  );
});

/* ─── SelectField (native select, styled) ─────────────────────────────── */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldChromeProps {
  options?: SelectOption[];
  /** First empty option text (e.g. "เลือกธนาคาร"). */
  placeholder?: string;
}

/**
 * Native <select> (best on phones: OS picker, accessible) with design-system
 * styling. Pass `options` or <option> children.
 */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { id, label, hint, error, optional, hideLabel, required, containerClassName, className, options, placeholder, children, ...props },
  ref,
) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} optional={optional} hideLabel={hideLabel} className={containerClassName}>
      {({ id: fieldId, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={fieldId}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(fieldControlClass, "h-11 cursor-pointer appearance-none pr-10 pointer-coarse:h-12", className)}
            {...props}
          >
            {placeholder !== undefined ? (
              <option value="" disabled={required}>
                {placeholder || t("shell.selectPlaceholder")}
              </option>
            ) : null}
            {options?.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
            {children}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-fg-subtle" />
        </div>
      )}
    </Field>
  );
});

/* ─── SearchField ─────────────────────────────────────────────────────── */

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible label (also the placeholder by default). */
  label?: string;
  containerClassName?: string;
}

/** Search input with icon and clear button (filters lists in place). */
export function SearchField({ value, onValueChange, label = t("shell.search"), placeholder, containerClassName, className, ...props }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative min-w-0 flex-1", containerClassName)}>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-fg-subtle" />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(fieldControlClass, "h-11 pr-10 pl-10 pointer-coarse:h-12 [&::-webkit-search-cancel-button]:hidden", className)}
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label={t("shell.clearSearch")}
          onClick={() => {
            onValueChange("");
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-(--radius-ctl-sm) text-fg-subtle hover:bg-press hover:text-fg pointer-coarse:after:absolute pointer-coarse:after:-inset-2"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
