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

/** "คอลัมน์" menu with a checkbox per column (desktop tables). */
export function ColumnToggle<T>({
  columns,
  hidden,
  onToggle,
  className,
}: {
  columns: DataTableColumn<T>[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
  className?: string;
}) {
  return (
    <Dropdown
      label={t("shell.showColumns")}
      placement="bottom-end"
      panelClassName="w-60"
      className={cn("hidden md:block", className)}
      trigger={({ open, triggerProps }) => (
        <button
          type="button"
          {...triggerProps}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border border-field-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-muted",
            open && "bg-surface-muted",
          )}
        >
          <Columns3 aria-hidden="true" className="size-4 text-fg-muted" />
          {t("shell.columns")}
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
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg hover:bg-press",
                  column.alwaysVisible ? "cursor-not-allowed opacity-60" : "cursor-pointer",
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
