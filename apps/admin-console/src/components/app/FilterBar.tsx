"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SearchField } from "./Fields";

export interface FilterBarProps {
  /** Controlled search (useTableState().searchValue / setSearchValue). Omit to hide the search box. */
  search?: { value: string; onValueChange: (value: string) => void; placeholder?: string; label?: string };
  /** Filter controls: <SelectField aria-label=… containerClassName="w-40" />, SegmentedControl, date inputs. */
  children?: ReactNode;
  /** Right side (ColumnToggle, export button). */
  actions?: ReactNode;
  /** Show "ล้างตัวกรอง" (useTableState().isFiltered) and what it does. */
  isFiltered?: boolean;
  onReset?: () => void;
  className?: string;
}

/**
 * Search + filters row above a table. Wraps on phones (search first, full
 * width), one line on desktop.
 */
export function FilterBar({ search, children, actions, isFiltered, onReset, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {search ? (
        <SearchField
          value={search.value}
          onValueChange={search.onValueChange}
          label={search.label}
          placeholder={search.placeholder}
          containerClassName="w-full min-w-48 md:w-auto md:max-w-sm md:flex-1"
        />
      ) : null}
      {children}
      {isFiltered && onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-fg-muted hover:bg-press hover:text-fg"
        >
          <X aria-hidden="true" className="size-4" />
          {t("shell.clearFilters")}
        </button>
      ) : null}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
