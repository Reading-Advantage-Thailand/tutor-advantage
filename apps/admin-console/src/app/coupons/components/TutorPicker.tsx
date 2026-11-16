"use client";

import { AlertCircle, Search, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Field, IconTile, Spinner } from "@/components/app";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { fieldControlClass } from "@/components/app/constants";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TutorOption } from "../couponForm";
import "@/locales/th/coupons";

export interface TutorPickerProps {
  value: TutorOption | null;
  onChange: (tutor: TutorOption | null) => void;
  disabled?: boolean;
}

/**
 * Search-as-you-type tutor picker (GET /v1/coupons/tutors?q=, active tutors
 * only, max 10). Replaces the free-text "tutor UUID" input.
 */
export function TutorPicker({ value, onChange, disabled }: TutorPickerProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TutorOption[]>([]);
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
        const data = await api.get<{ tutors: TutorOption[] }>("/v1/coupons/tutors", { query: { q } });
        if (!cancelled) {
          setResults(data.tutors ?? []);
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

  const pick = (tutor: TutorOption) => {
    focusNext.current = "clear";
    onChange(tutor);
    setQuery("");
    setResults([]);
  };

  // A failed search is an error, not helper text: danger colour, icon, announced.
  const searchError = error ? (
    <p role="alert" className="flex items-start gap-1 px-3 py-2.5 text-[0.8125rem] text-danger-fg">
      <AlertCircle aria-hidden="true" className="mt-[3px] size-3.5 shrink-0" />
      <span>{error}</span>
    </p>
  ) : null;

  if (value) {
    return (
      <Field label={t("coupons.tutorLabel")} optional hint={t("coupons.tutorHint")}>
        <div className="flex min-h-11 items-center gap-3 rounded-(--radius-ctl) border border-clay-rim bg-surface-muted py-2 pr-1.5 pl-3">
          <IconTile icon={UserRound} tone="brand" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg" title={value.displayName ?? undefined}>
              {value.displayName || t("coupons.tutorUnnamed")}
            </p>
            {value.email ? (
              <p className="truncate text-[0.8125rem] text-fg-muted" title={value.email}>
                {value.email}
              </p>
            ) : null}
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
            {t("coupons.tutorClear")}
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <Field label={t("coupons.tutorLabel")} optional hint={t("coupons.tutorHint")}>
      {({ id, describedBy }) => (
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
            autoComplete="off"
            disabled={disabled}
            value={query}
            placeholder={t("coupons.tutorSearchPlaceholder")}
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
                  <Spinner /> {t("coupons.tutorSearching")}
                </p>
              ) : results.length === 0 ? (
                searchError ?? <p className="px-3 py-2.5 text-[0.8125rem] text-fg-muted">{t("coupons.tutorNoResults")}</p>
              ) : (
                <>
                  {searchError}
                  <ul id={listId} role="listbox" aria-label={t("coupons.tutorLabel")} className="max-h-60 overflow-y-auto py-1">
                    {results.map((tutor, index) => (
                      <li
                        key={tutor.userId}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={index === active}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pick(tutor)}
                        onMouseEnter={() => setActive(index)}
                        className={cn(
                          "flex cursor-pointer flex-col px-3 py-2 pointer-coarse:py-3",
                          index === active ? "bg-brand-soft text-brand-fg shadow-[inset_3px_0_0_var(--brand-fg)]" : "",
                        )}
                      >
                        <span className="truncate text-sm font-medium text-fg">{tutor.displayName || t("coupons.tutorUnnamed")}</span>
                        {tutor.email ? <span className="truncate text-[0.8125rem] text-fg-muted">{tutor.email}</span> : null}
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
