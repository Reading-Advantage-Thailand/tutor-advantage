/**
 * URL ⇄ table state (page, page size, sort, search, filters). Pure helpers
 * used by `useTableState()` (hooks/useTableState.ts) and unit tests.
 *
 * URL shape (defaults are omitted so URLs stay short and shareable):
 *   ?page=2&size=50&sort=-createdAt&q=somchai&status=PENDING
 * `sort=key` ascending, `sort=-key` descending. With `prefix: "lines"` the
 * params become lines_page, lines_size, … (two tables on one page).
 */
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDirection;
}

export interface TableStateConfig {
  /** Default 20. */
  defaultPageSize?: number;
  /** Allowed page sizes (others fall back to the default). Default [10, 20, 50, 100]. */
  pageSizes?: readonly number[];
  defaultSort?: SortState | null;
  /** Sortable keys; a sort param outside this list is ignored. Omit to allow any [A-Za-z0-9_.]. */
  sortKeys?: readonly string[];
  /** Filter param names kept in the URL (e.g. ["status", "from", "to"]). */
  filterKeys?: readonly string[];
  /** Default filter values (omitted from the URL when equal). */
  defaultFilters?: Readonly<Record<string, string>>;
  /** Param prefix for a second table on the same page. */
  prefix?: string;
}

export interface TableState {
  page: number;
  pageSize: number;
  sort: SortState | null;
  q: string;
  filters: Record<string, string>;
}

export const DEFAULT_PAGE_SIZES = [10, 20, 50, 100] as const;

interface ParamsLike {
  get(name: string): string | null;
}

function name(config: TableStateConfig, key: string) {
  return config.prefix ? `${config.prefix}_${key}` : key;
}

export function parseSort(value: string | null | undefined, config: TableStateConfig = {}): SortState | null {
  if (!value) return config.defaultSort ?? null;
  const dir: SortDirection = value.startsWith("-") ? "desc" : "asc";
  const key = value.replace(/^[-+]/, "");
  if (!/^[A-Za-z0-9_.]{1,64}$/.test(key)) return config.defaultSort ?? null;
  if (config.sortKeys && !config.sortKeys.includes(key)) return config.defaultSort ?? null;
  return { key, dir };
}

export function formatSort(sort: SortState | null): string {
  if (!sort) return "";
  return sort.dir === "desc" ? `-${sort.key}` : sort.key;
}

export function parseTableState(params: ParamsLike, config: TableStateConfig = {}): TableState {
  const pageSizes = config.pageSizes ?? DEFAULT_PAGE_SIZES;
  const defaultPageSize = config.defaultPageSize ?? 20;
  const rawPage = Number.parseInt(params.get(name(config, "page")) ?? "", 10);
  const rawSize = Number.parseInt(params.get(name(config, "size")) ?? "", 10);
  const filters: Record<string, string> = {};
  for (const key of config.filterKeys ?? []) {
    const value = params.get(name(config, key));
    const fallback = config.defaultFilters?.[key];
    if (value !== null && value !== "") filters[key] = value.slice(0, 200);
    else if (fallback !== undefined && value === null) filters[key] = fallback;
  }
  return {
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(rawPage, 100_000) : 1,
    pageSize: pageSizes.includes(rawSize) ? rawSize : defaultPageSize,
    sort: parseSort(params.get(name(config, "sort")), config),
    q: (params.get(name(config, "q")) ?? "").slice(0, 200),
    filters,
  };
}

/**
 * Write `state` into a copy of `base` (other params are preserved). Values
 * equal to their defaults are removed.
 */
export function serializeTableState(
  state: TableState,
  config: TableStateConfig = {},
  base: string | URLSearchParams = "",
): URLSearchParams {
  const params = new URLSearchParams(typeof base === "string" ? base : base.toString());
  const set = (key: string, value: string, isDefault: boolean) => {
    const param = name(config, key);
    if (isDefault || value === "") params.delete(param);
    else params.set(param, value);
  };
  set("page", String(state.page), state.page <= 1);
  set("size", String(state.pageSize), state.pageSize === (config.defaultPageSize ?? 20));
  const sort = formatSort(state.sort);
  set("sort", sort, sort === formatSort(config.defaultSort ?? null));
  set("q", state.q.trim(), false);
  for (const key of config.filterKeys ?? []) {
    const value = state.filters[key] ?? "";
    const fallback = config.defaultFilters?.[key];
    if (fallback !== undefined && value === "" && fallback !== "") {
      // Explicitly cleared a non-empty default: keep an empty marker.
      params.set(name(config, key), "");
    } else {
      set(key, value, fallback !== undefined && value === fallback);
    }
  }
  return params;
}

/** Cycle a header click: none → asc → desc → (default). */
export function nextSort(current: SortState | null, key: string, defaultSort: SortState | null = null): SortState | null {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return defaultSort && defaultSort.key !== key ? defaultSort : null;
}

/**
 * Query params for the backend list endpoint: page, pageSize, sort, order, q
 * and filters (empty values dropped). Rename keys in the page if the API
 * differs (e.g. `limit`).
 */
export function toApiQuery(state: TableState): Record<string, string | number> {
  const query: Record<string, string | number> = { page: state.page, pageSize: state.pageSize };
  if (state.sort) {
    query.sort = state.sort.key;
    query.order = state.sort.dir;
  }
  if (state.q.trim()) query.q = state.q.trim();
  for (const [key, value] of Object.entries(state.filters)) {
    if (value !== "") query[key] = value;
  }
  return query;
}

/** Total pages (≥ 1). */
export function pageCount(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0 || pageSize <= 0) return 1;
  return Math.ceil(total / pageSize);
}
