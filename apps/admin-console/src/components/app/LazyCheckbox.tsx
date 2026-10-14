"use client";

import dynamic from "next/dynamic";

/**
 * Base UI checkbox loaded on demand: DataTable selection and the ColumnToggle
 * menu only render checkboxes after data loads / a menu opens, so the Base UI
 * checkbox runtime (~8 kB gz) stays out of every table page's first load.
 * The placeholder has the same box so nothing shifts while it loads.
 * Client-only (ssr: false): a server-rendered Base UI checkbox under a lazy
 * boundary hydrates with a different useId() and logs a mismatch.
 */
export const LazyCheckbox = dynamic(() => import("@/components/ui/checkbox").then((m) => m.Checkbox), {
  loading: () => (
    <span
      aria-hidden="true"
      className="relative flex size-[18px] shrink-0 rounded-[5px] border border-field-border bg-surface"
    />
  ),
  ssr: false,
});
