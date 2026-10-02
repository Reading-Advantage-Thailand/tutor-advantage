"use client";

import { Search, UserRound, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Field, Spinner } from "@/components/app";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { fieldControlClass } from "@/components/app/constants";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TutorOption } from "../couponForm";

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
  const open = !value && query.trim().length > 0;

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
    onChange(tutor);
    setQuery("");
    setResults([]);
  };

  if (value) {
    return (
      <Field label={t("coupons.tutorLabel")} optional hint={t("coupons.tutorHint")}>
        <div className="flex min-h-11 items-center gap-3 rounded-lg border border-hairline bg-surface-muted px-3 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-fg">
            <UserRound aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{value.displayName || t("coupons.tutorUnnamed")}</p>
            {value.email ? <p className="truncate text-[0.8125rem] text-fg-muted">{value.email}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>
            <X aria-hidden="true" />
            {t("coupons.tutorClear")}
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <Field label={t("coupons.tutorLabel")} optional hint={error ?? t("coupons.tutorHint")}>
      {({ id, describedBy }) => (
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
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
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
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
            className={cn(fieldControlClass, "h-9 pl-9 pointer-coarse:h-11")}
          />
          {open ? (
            <div className="mt-1.5 overflow-hidden rounded-lg border border-hairline bg-surface shadow-popover">
              {loading && results.length === 0 ? (
                <p className="flex items-center gap-2 px-3 py-2.5 text-[0.8125rem] text-fg-muted">
                  <Spinner /> {t("coupons.tutorSearching")}
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2.5 text-[0.8125rem] text-fg-muted">{error ?? t("coupons.tutorNoResults")}</p>
              ) : (
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
                        index === active ? "bg-surface-muted" : "",
                      )}
                    >
                      <span className="truncate text-sm font-medium text-fg">{tutor.displayName || t("coupons.tutorUnnamed")}</span>
                      {tutor.email ? <span className="truncate text-[0.8125rem] text-fg-muted">{tutor.email}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Field>
  );
}
