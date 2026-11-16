"use client";

import { SelectField, type MoreFilters, type SelectOption } from "@/components/app";
import type { UseTableStateResult } from "@/hooks/useTableState";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import "@/locales/th/users";

/**
 * The users table's select filters (patterns.md A2): the two the toolbar shows
 * on desktop (สถานะเอกสาร, สถานะบัญชี), and the "ตัวกรอง" sheet with all
 * three (the document-expiry one lives only there) whose active filters show
 * as removable chips. Every control drives the same URL state through
 * useTableState().
 */

const ACCOUNT_OPTIONS: SelectOption[] = [
  { value: "", label: t("users.accountAll") },
  { value: "ACTIVE", label: statusLabel("account", "ACTIVE") },
  { value: "SUSPENDED", label: statusLabel("account", "SUSPENDED") },
  { value: "ANONYMIZED", label: statusLabel("account", "ANONYMIZED") },
];
const VERIFICATION_OPTIONS: SelectOption[] = [
  { value: "", label: t("users.verificationAll") },
  { value: "REVIEW", label: t("users.verificationReview") },
  { value: "UNVERIFIED", label: statusLabel("verification", "UNVERIFIED") },
  { value: "PENDING", label: statusLabel("verification", "PENDING") },
  { value: "VERIFIED", label: statusLabel("verification", "VERIFIED") },
  { value: "REJECTED", label: statusLabel("verification", "REJECTED") },
];
const DOCUMENT_OPTIONS: SelectOption[] = [
  { value: "", label: t("users.documentsAll") },
  { value: "EXPIRING", label: t("users.documentsExpiring") },
  { value: "EXPIRED", label: t("users.documentsExpired") },
];

type FilterKey = "verification" | "documents" | "status";

const FILTERS: { key: FilterKey; label: string; options: SelectOption[] }[] = [
  { key: "verification", label: t("users.filterVerification"), options: VERIFICATION_OPTIONS },
  { key: "documents", label: t("users.filterDocuments"), options: DOCUMENT_OPTIONS },
  { key: "status", label: t("users.filterAccount"), options: ACCOUNT_OPTIONS },
];

function filterDef(key: FilterKey) {
  return FILTERS.find((filter) => filter.key === key)!;
}

function activeFilters(table: UseTableStateResult) {
  return FILTERS.filter((filter) => (table.filters[filter.key] ?? "") !== "");
}

/** One select bound to a table filter (label visible in the sheet, aria-label in the toolbar). */
function FilterSelect({
  table,
  filterKey,
  inline,
  containerClassName,
}: {
  table: UseTableStateResult;
  filterKey: FilterKey;
  inline?: boolean;
  containerClassName?: string;
}) {
  const filter = filterDef(filterKey);
  return (
    <SelectField
      // Stable ids: a generated useId() differed between the server render and hydration here.
      id={`users-filter-${inline ? "bar" : "sheet"}-${filter.key}`}
      {...(inline ? { "aria-label": filter.label } : { label: filter.label })}
      containerClassName={containerClassName}
      value={table.filters[filter.key] ?? ""}
      onChange={(event) => table.setFilter(filter.key, event.target.value)}
      options={filter.options}
    />
  );
}

/**
 * Toolbar part from 768px: the two inline selects. Phones get every filter
 * from the sheet instead (patterns.md A2 "Phone: filters in a sheet").
 */
export function InlineFilters({ table }: { table: UseTableStateResult }) {
  return (
    <div className="hidden min-w-0 items-center gap-2 md:flex">
      <FilterSelect table={table} filterKey="verification" inline containerClassName="w-40" />
      <FilterSelect table={table} filterKey="status" inline containerClassName="w-40" />
    </div>
  );
}

/**
 * The "ตัวกรอง" sheet for FilterBar's `moreFilters` (shown at every width:
 * the document-expiry filter lives only there): every select with a visible
 * label, plus removable chips for the active ones. From 768px the button is
 * a 36px icon button (the word stays its accessible name and tooltip).
 */
export function userMoreFilters(table: UseTableStateResult): MoreFilters {
  return {
    show: "always",
    children: FILTERS.map((filter) => <FilterSelect key={filter.key} table={table} filterKey={filter.key} />),
    active: activeFilters(table).map((filter) => {
      const value = filter.options.find((option) => option.value === table.filters[filter.key])?.label ?? table.filters[filter.key];
      return { key: filter.key, label: `${filter.label}: ${value}`, onRemove: () => table.setFilter(filter.key, "") };
    }),
    onReset: () => table.setFilters({ verification: "", documents: "", status: "" }),
  };
}
