"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatSort,
  nextSort,
  parseTableState,
  serializeTableState,
  toApiQuery,
  type SortState,
  type TableState,
  type TableStateConfig,
} from "../lib/tableState";

export interface UseTableStateResult extends TableState {
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (sort: SortState | null) => void;
  /** Header click: asc → desc → default. */
  toggleSort: (key: string) => void;
  /** Commit a search term to the URL immediately (resets page). */
  setQuery: (q: string) => void;
  /** Controlled value for a <SearchField>: updates instantly, commits to the URL after `searchDebounceMs`. */
  searchValue: string;
  setSearchValue: (value: string) => void;
  setFilter: (key: string, value: string) => void;
  setFilters: (filters: Record<string, string>) => void;
  /** Clear search + filters + sort + page. */
  reset: () => void;
  /** True when q or any filter differs from its default. */
  isFiltered: boolean;
  /** Backend query params: { page, pageSize, sort, order, q, ...filters }. */
  apiQuery: Record<string, string | number>;
  /** Stable string of the state: use it in useCachedResource keys. */
  queryKey: string;
}

/**
 * Table state (page / pageSize / sort / q / filters) synced to the URL search
 * params, so lists are shareable, survive reloads and back/forward works.
 * Changing anything but `page` resets to page 1. Updates use
 * `router.replace(…, { scroll: false })`.
 *
 * @example
 * const table = useTableState({ filterKeys: ["status"], defaultSort: { key: "createdAt", dir: "desc" } });
 * const { data } = useCachedResource(`${userId}:coupons:${table.queryKey}`,
 *   () => api.get<CouponPage>("/v1/coupons", { query: table.apiQuery }), { keepPreviousData: true });
 */
export function useTableState(config: TableStateConfig & { searchDebounceMs?: number } = {}): UseTableStateResult {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const configRef = useRef(config);
  configRef.current = config;
  const paramsString = searchParams?.toString() ?? "";

  const state = useMemo(
    () => parseTableState(new URLSearchParams(paramsString), configRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramsString],
  );

  const commit = useCallback(
    (next: TableState) => {
      const params = serializeTableState(next, configRef.current, paramsString);
      const qs = params.toString();
      if (qs === paramsString) return;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [paramsString, pathname, router],
  );

  const [searchValue, setSearchInput] = useState(state.q);
  const lastCommittedQ = useRef(state.q);
  // URL changed from outside (back/forward, reset): follow it.
  useEffect(() => {
    if (state.q !== lastCommittedQ.current) {
      lastCommittedQ.current = state.q;
      setSearchInput(state.q);
    }
  }, [state.q]);

  const debounceMs = config.searchDebounceMs ?? 300;
  useEffect(() => {
    if (searchValue === state.q) return;
    const timer = window.setTimeout(() => {
      lastCommittedQ.current = searchValue;
      commit({ ...state, q: searchValue, page: 1 });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [searchValue, state, commit, debounceMs]);

  const defaults = config.defaultFilters ?? {};
  const isFiltered =
    state.q.trim() !== "" ||
    Object.entries(state.filters).some(([key, value]) => value !== (defaults[key] ?? "")) ||
    Object.keys(defaults).some((key) => !(key in state.filters) && defaults[key] !== "");

  return {
    ...state,
    setPage: (page) => commit({ ...state, page: Math.max(1, Math.floor(page)) }),
    setPageSize: (pageSize) => commit({ ...state, pageSize, page: 1 }),
    setSort: (sort) => commit({ ...state, sort, page: 1 }),
    toggleSort: (key) => commit({ ...state, sort: nextSort(state.sort, key, configRef.current.defaultSort ?? null), page: 1 }),
    setQuery: (q) => {
      lastCommittedQ.current = q;
      setSearchInput(q);
      commit({ ...state, q, page: 1 });
    },
    searchValue,
    setSearchValue: setSearchInput,
    setFilter: (key, value) => commit({ ...state, filters: { ...state.filters, [key]: value }, page: 1 }),
    setFilters: (filters) => commit({ ...state, filters: { ...state.filters, ...filters }, page: 1 }),
    reset: () => {
      lastCommittedQ.current = "";
      setSearchInput("");
      commit({
        page: 1,
        pageSize: state.pageSize,
        sort: configRef.current.defaultSort ?? null,
        q: "",
        filters: { ...(configRef.current.defaultFilters ?? {}) },
      });
    },
    isFiltered,
    apiQuery: toApiQuery(state),
    queryKey: `p${state.page}:s${state.pageSize}:o${formatSort(state.sort)}:q${state.q}:f${JSON.stringify(state.filters)}`,
  };
}
