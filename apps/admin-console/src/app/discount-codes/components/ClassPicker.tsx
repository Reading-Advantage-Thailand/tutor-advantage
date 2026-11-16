"use client";

import { AlertCircle, School, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Chip, Field, IconTile, Spinner } from "@/components/app";
import { fieldControlClass } from "@/components/app/constants";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AdminClass, AdminClassPage } from "../../classes/classForm";
import "@/locales/th/discountCodes";

export interface ClassPickerProps {
  value: AdminClass | null;
  onChange: (value: AdminClass | null) => void;
  disabled?: boolean;
  error?: string;
  /** The preselected class (?classId=) is still loading. */
  loading?: boolean;
  /** Shown under the search box (e.g. the preselected class was not found). */
  notice?: string;
}

/** "ครู ก · Primary Origins 2 · ฿3,000": what tells two classes with the same title apart. */
function classMeta(item: AdminClass): string {
  const tutor = item.tutor ? item.tutor.displayName || item.tutor.email || t("discountCodes.tutorUnnamed") : null;
  return [tutor, item.bookCode, formatSatang(item.packagePriceSatang)].filter(Boolean).join(" · ");
}

/**
 * Search-as-you-type class picker (GET /v1/admin/classes?q=, demo classes
 * excluded, max 10). Same ARIA combobox pattern as the coupon TutorPicker.
 */
export function ClassPicker({ value, onChange, disabled, error: fieldError, loading: preselecting, notice }: ClassPickerProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  // Escape closes the list without clearing the query; typing opens it again.
  const [dismissed, setDismissed] = useState(false);
  const open = !value && query.trim().length > 0 && !dismissed;

  // Picking replaces the search box with the chosen card, and clearing does the
  // reverse: move focus to the control that took the focused one's place.
  const inputRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"input" | "clear" | null>(null);
  useEffect(() => {
    if (focusNext.current === "input" && !value) inputRef.current?.focus();
    else if (focusNext.current === "clear" && value) clearRef.current?.focus();
    else return;
    focusNext.current = null;
  }, [value]);

  useEffect(() => {
    if (value) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const data = await api.get<AdminClassPage>("/v1/admin/classes", { query: { q, pageSize: 10 } });
        if (!cancelled) {
          setResults(data.items ?? []);
          setActive(0);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, value]);

  const pick = (item: AdminClass) => {
    focusNext.current = "clear";
    onChange(item);
    setQuery("");
    setResults([]);
  };

  if (value) {
    return (
      <Field label={t("discountCodes.classLabel")} required error={fieldError}>
        <div className="flex min-h-11 items-center gap-3 rounded-(--radius-ctl) border border-clay-rim bg-surface-muted py-2 pr-1.5 pl-3">
          <IconTile icon={School} tone="brand" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-fg">
              <span className="truncate" title={value.title}>
                {value.title}
              </span>
              {value.setupRequired ? (
                <Chip tone="warning" size="sm">
                  {t("discountCodes.classSetupPending")}
                </Chip>
              ) : null}
            </p>
            <p className="truncate text-[0.8125rem] text-fg-muted" title={classMeta(value)}>
              {classMeta(value)}
            </p>
          </div>
          <Button
            ref={clearRef}
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              focusNext.current = "input";
              onChange(null);
            }}
          >
            <X aria-hidden="true" />
            {t("discountCodes.classChange")}
          </Button>
        </div>
      </Field>
    );
  }

  // A failed search is an error, not helper text: danger colour, icon, announced.
  const searchError = error ? (
    <p role="alert" className="flex items-start gap-1 px-3 py-2.5 text-[0.8125rem] text-danger-fg">
      <AlertCircle aria-hidden="true" className="mt-[3px] size-3.5 shrink-0" />
      <span>{error}</span>
    </p>
  ) : null;

  if (preselecting) {
    return (
      <Field label={t("discountCodes.classLabel")} required>
        <p className="flex min-h-11 items-center gap-2 rounded-lg border border-hairline px-3 text-[0.8125rem] text-fg-muted">
          <Spinner /> {t("discountCodes.classLoading")}
        </p>
      </Field>
    );
  }

  return (
    <Field label={t("discountCodes.classLabel")} required error={fieldError} hint={notice ?? t("discountCodes.classHint")}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-2.5 left-3 size-4 text-fg-subtle pointer-coarse:top-3.5" />
          <input
            ref={inputRef}
            id={id}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            autoComplete="off"
            disabled={disabled}
            value={query}
            placeholder={t("discountCodes.classSearchPlaceholder")}
            onChange={(event) => {
              setQuery(event.target.value);
              setDismissed(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                // Close the list only: keep the typed text, and keep the sheet open
                // (Base UI closes the sheet from a document keydown listener).
                event.preventDefault();
                event.stopPropagation();
                event.nativeEvent.stopImmediatePropagation();
                setDismissed(true);
                return;
              }
              if (event.key === "ArrowDown" && dismissed) {
                event.preventDefault();
                setDismissed(false);
                return;
              }
              if (!open || results.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => (index + 1) % results.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => (index - 1 + results.length) % results.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                pick(results[active]);
              }
            }}
            className={cn(fieldControlClass, "h-9 pl-9 pointer-coarse:h-11 [&::-webkit-search-cancel-button]:hidden")}
          />
          {open ? (
            <div className="mt-1.5 overflow-hidden rounded-lg border border-hairline bg-surface shadow-popover">
              {loading && results.length === 0 ? (
                <p className="flex items-center gap-2 px-3 py-2.5 text-[0.8125rem] text-fg-muted">
                  <Spinner /> {t("discountCodes.classSearching")}
                </p>
              ) : results.length === 0 ? (
                searchError ?? <p className="px-3 py-2.5 text-[0.8125rem] text-fg-muted">{t("discountCodes.classNoResults")}</p>
              ) : (
                <>
                  {searchError}
                  <ul id={listId} role="listbox" aria-label={t("discountCodes.classLabel")} className="max-h-60 overflow-y-auto py-1">
                    {results.map((item, index) => (
                      <li
                        key={item.classId}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={index === active}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pick(item)}
                        onMouseEnter={() => setActive(index)}
                        className={cn(
                          "flex cursor-pointer flex-col px-3 py-2 pointer-coarse:py-3",
                          index === active ? "bg-brand-soft text-brand-fg shadow-[inset_3px_0_0_var(--brand-fg)]" : "",
                        )}
                      >
                        <span className="truncate text-sm font-medium text-fg">{item.title}</span>
                        <span className="truncate text-[0.8125rem] text-fg-muted">{classMeta(item)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Field>
  );
}
