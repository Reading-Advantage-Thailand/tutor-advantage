"use client";

import { Columns3 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LazyCheckbox as Checkbox } from "./LazyCheckbox";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DataTableColumn } from "./DataTable";
import { Dropdown } from "./Dropdown";

/**
 * Hidden-column state for a DataTable, remembered per table in localStorage
 * (a per-viewer convenience). Starts from the columns' `defaultHidden`.
 */
export function useColumnVisibility<T>(tableId: string, columns: DataTableColumn<T>[]) {
  const storageKey = `admin-cols:${tableId}`;
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((column) => column.defaultHidden).map((column) => column.key)),
  );
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setHidden(new Set(JSON.parse(stored) as string[]));
    } catch {
      // storage unavailable or corrupt: keep defaults
    }
  }, [storageKey]);
  const toggle = useCallback(
    (key: string) => {
      setHidden((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        try {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [storageKey],
  );
  return { hidden, toggle } as const;
}

/**
 * "คอลัมน์" menu with a checkbox per column (desktop tables).
 *
 * Pass a stable `id` (e.g. "users-columns"): the menu's aria-controls then
 * does not come from useId(), which can differ between the server render and
 * hydration in these pages. `compact` shows the icon only (36px; 44 on touch)
 * for crowded toolbars; the word stays its accessible name and tooltip.
 */
export function ColumnToggle<T>({
  columns,
  hidden,
  onToggle,
  id,
  compact = false,
  className,
}: {
  columns: DataTableColumn<T>[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
  /** Stable id of the menu panel (aria-controls). Unique per page. */
  id?: string;
  /** Icon-only button; "xl" keeps the word from 1280px, "2xl" from 1536px. */
  compact?: boolean | "xl" | "2xl";
  className?: string;
}) {
  const iconOnly =
    compact === true ? "w-9 px-0 pointer-coarse:min-w-11" : compact === "xl" ? "max-xl:w-9 max-xl:px-0 max-xl:pointer-coarse:min-w-11" : compact === "2xl" ? "max-2xl:w-9 max-2xl:px-0 max-2xl:pointer-coarse:min-w-11" : undefined;
  const wordClass = compact === true ? "sr-only" : compact === "xl" ? "max-xl:sr-only" : compact === "2xl" ? "max-2xl:sr-only" : undefined;
  return (
    <Dropdown
      id={id}
      label={t("shell.showColumns")}
      placement="bottom-end"
      panelClassName="w-60"
      className={cn("hidden md:block", className)}
      trigger={({ open, triggerProps }) => (
        <button
          type="button"
          {...triggerProps}
          title={compact ? t("shell.columns") : undefined}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 rounded-(--radius-ctl) border border-field-border bg-surface px-3.5 text-sm font-semibold whitespace-nowrap text-fg transition-colors hover:bg-row-hover pointer-coarse:min-h-11",
            iconOnly,
            open && "bg-surface-muted",
          )}
        >
          <Columns3 aria-hidden="true" className="size-4 shrink-0" />
          <span className={wordClass}>{t("shell.columns")}</span>
        </button>
      )}
    >
      {() => (
        <div className="flex flex-col p-1.5">
          <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-fg-muted">{t("shell.showColumns")}</p>
          {columns.map((column) => {
            const label = column.label ?? (typeof column.header === "string" ? column.header : column.key);
            return (
              <label
                key={column.key}
                className={cn(
                  "flex min-h-10 items-center gap-2.5 rounded-(--radius-ctl-sm) px-2.5 text-sm text-fg hover:bg-press pointer-coarse:min-h-11",
                  column.alwaysVisible ? "cursor-not-allowed opacity-45" : "cursor-pointer",
                )}
              >
                <Checkbox
                  checked={!hidden.has(column.key)}
                  disabled={column.alwaysVisible}
                  onCheckedChange={() => onToggle(column.key)}
                />
                {label}
              </label>
            );
          })}
        </div>
      )}
    </Dropdown>
  );
}
