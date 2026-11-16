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
  /**
   * Controlled value for a <SearchField>: updates instantly and keeps the text as typed (spaces
   * included); the trimmed term commits to the URL after `searchDebounceMs`.
   */
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
 * The values returned (page, sort, q, filters, apiQuery…) always mirror the
 * URL. The setters build on the last change asked for, even while its
 * navigation is still in flight, so two quick changes add up instead of the
 * second one undoing the first.
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

  // The commit that has not landed yet: the params router.replace() was issued from and the state
  // it carries. useSearchParams() keeps returning the old params until that navigation lands, so
  // until then `state` is behind what the admin last asked for.
  const inFlight = useRef<{ from: string; state: TableState } | null>(null);
  // The URL moved (the commit landed, or back/forward or a link went somewhere else): nothing is in
  // flight any more. Without this, coming back to the same params later would revive a stale commit.
  useEffect(() => {
    if (inFlight.current && inFlight.current.from !== paramsString) inFlight.current = null;
  }, [paramsString]);

  /** The state in flight, or null when the URL is up to date. */
  const pending = useCallback(
    () => (inFlight.current?.from === paramsString ? inFlight.current.state : null),
    [paramsString],
  );
  // What the next change builds on. Building on the stale `state` while a commit is in flight
  // would re-serialize what that commit changed (e.g. bring back the filters reset() just cleared).
  const base = () => pending() ?? state;

  const commit = useCallback(
    (next: TableState) => {
      const params = serializeTableState(next, configRef.current, paramsString);
      const qs = params.toString();
      if (qs === paramsString) {
        // Already there, unless a commit is on its way somewhere else: then this one takes it back.
        if (!pending()) return;
        inFlight.current = null;
      } else {
        inFlight.current = { from: paramsString, state: next };
      }
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [paramsString, pathname, pending, router],
  );

  // The box keeps the text as typed. Only the trimmed term goes to the URL and the query, and the
  // two are compared trimmed: "สมชาย " with the surname still to come must not be written back as
  // "สมชาย" when its own commit lands.
  const [searchValue, setSearchInput] = useState(state.q);
  const lastCommittedQ = useRef(state.q.trim());
  // URL changed from outside (back/forward, reset): follow it.
  useEffect(() => {
    const term = state.q.trim();
    if (term !== lastCommittedQ.current) {
      lastCommittedQ.current = term;
      setSearchInput(state.q);
    }
  }, [state.q]);

  const debounceMs = config.searchDebounceMs ?? 300;
  useEffect(() => {
    const term = searchValue.trim();
    if (term === state.q.trim()) return;
    // This term is already on its way (reset() or a commit that has not landed yet).
    if (term === lastCommittedQ.current && pending()) return;
    const timer = window.setTimeout(() => {
      lastCommittedQ.current = term;
      commit({ ...(pending() ?? state), q: term, page: 1 });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [searchValue, state, pending, commit, debounceMs]);

  const defaults = config.defaultFilters ?? {};
  const isFiltered =
    state.q.trim() !== "" ||
    Object.entries(state.filters).some(([key, value]) => value !== (defaults[key] ?? "")) ||
    Object.keys(defaults).some((key) => !(key in state.filters) && defaults[key] !== "");

  return {
    ...state,
    setPage: (page) => commit({ ...base(), page: Math.max(1, Math.floor(page)) }),
    setPageSize: (pageSize) => commit({ ...base(), pageSize, page: 1 }),
    setSort: (sort) => commit({ ...base(), sort, page: 1 }),
    toggleSort: (key) => {
      const from = base();
      commit({ ...from, sort: nextSort(from.sort, key, configRef.current.defaultSort ?? null), page: 1 });
    },
    setQuery: (q) => {
      lastCommittedQ.current = q.trim();
      setSearchInput(q);
      commit({ ...base(), q: q.trim(), page: 1 });
    },
    searchValue,
    setSearchValue: setSearchInput,
    setFilter: (key, value) => {
      const from = base();
      commit({ ...from, filters: { ...from.filters, [key]: value }, page: 1 });
    },
    setFilters: (filters) => {
      const from = base();
      commit({ ...from, filters: { ...from.filters, ...filters }, page: 1 });
    },
    reset: () => {
      lastCommittedQ.current = "";
      setSearchInput("");
      commit({
        page: 1,
        pageSize: base().pageSize,
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
