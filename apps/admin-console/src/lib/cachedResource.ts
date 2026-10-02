/**
 * Tiny stale-while-revalidate cache for client-side admin data
 * (ported from apps/tutor-pwa/src/lib/cachedResource.ts).
 *
 * ADMIN CONSOLE: keys MUST start with the signed-in admin's user id
 * (`useAdminSession().userId`), e.g. `${userId}:settlements:list:${query}`.
 * A 401 clears the cache and all admin cookies, then goes to /login.
 * Use `api.get()` from "@/lib/api" as the fetcher (it throws ApiError).
 *
 * Original notes (tutor app):
 *
 * - One module-level store, so every component that uses the same key shares
 *   the same data, error and in-flight request.
 * - Cached data renders immediately on revisit (no full-screen loader) and is
 *   revalidated in the background when older than `staleTime`.
 * - A 401 means the httpOnly `admin_token` cookie is gone or expired: the
 *   error is stored on the entry and the unauthorized handler runs once
 *   (default: clear the cache and go to the login page "/").
 * - Account safety: the cache lives only in the browser (never on the server),
 *   it is cleared on logout (AppShell) and keys MUST start with the admin user id,
 *   e.g. `${userId}:classes`, so one admin never sees another's data.
 *
 * Key convention: colon-separated segments, `${userId}:<resource>[:<params>]`.
 * Prefix helpers match on plain string prefixes, so pass `${userId}:classes:`
 * (with the trailing colon) to target a group.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

/** Default freshness window before a cached entry is revalidated on mount/focus. */
export const DEFAULT_STALE_TIME_MS = 30_000;

/** Upper bound on cached keys; least-recently-updated unobserved entries are evicted. */
const MAX_ENTRIES = 150;

/** Immutable snapshot of one cache entry. */
export interface ResourceState<T> {
  data: T | undefined;
  error: unknown;
  /** Epoch ms of the last successful fetch/mutate; 0 = never, or invalidated. */
  updatedAt: number;
  /** A request for this key is in flight. */
  isValidating: boolean;
}

export interface CachedResourceOptions {
  /** When false the hook never fetches (it still returns cached data for a non-null key). Default true. */
  enabled?: boolean;
  /** Milliseconds cached data counts as fresh (no revalidation on mount/focus). Default 30 000. */
  staleTime?: number;
  /** Revalidate stale data when the tab becomes visible again. Default true. */
  revalidateOnFocus?: boolean;
  /** While a new key has no data yet, keep returning the previous key's data (e.g. search filters). Default false. */
  keepPreviousData?: boolean;
}

export interface MutateOptions {
  /** Refetch from the server after applying the local change. Default false. */
  revalidate?: boolean;
}

export type ResourceUpdater<T> = T | ((current: T | undefined) => T);

export interface CachedResource<T> {
  data: T | undefined;
  error: unknown;
  /** True only while there is no data to show yet (render a skeleton). False when idle/disabled or on error. */
  isLoading: boolean;
  /** A request is in flight (initial load, background revalidation or refetch). */
  isValidating: boolean;
  /** `data` belongs to the previous key (keepPreviousData); dim it while the new key loads. */
  isPreviousData: boolean;
  /** Fetch now (deduped with an in-flight request). Never rejects: resolves undefined on error. */
  refetch: () => Promise<T | undefined>;
  /** Replace the cached data locally (optimistic update), optionally revalidating. */
  mutate: (next: ResourceUpdater<T>, options?: MutateOptions) => void;
}

type Listener = () => void;

interface KeyRecord {
  state: ResourceState<unknown>;
  /** Bumped by invalidate/clear so results of requests started earlier are dropped. */
  generation: number;
  inflight: Promise<unknown> | null;
  listeners: Set<Listener>;
  /** Mounted, enabled hooks register a way to refetch with their latest fetcher. */
  revalidators: Set<() => void>;
}

const EMPTY_STATE: ResourceState<never> = Object.freeze({
  data: undefined,
  error: undefined,
  updatedAt: 0,
  isValidating: false,
});

const records = new Map<string, KeyRecord>();

function getRecord(key: string): KeyRecord {
  let record = records.get(key);
  if (!record) {
    record = {
      state: EMPTY_STATE,
      generation: 0,
      inflight: null,
      listeners: new Set(),
      revalidators: new Set(),
    };
    records.set(key, record);
  }
  return record;
}

function setState(key: string, record: KeyRecord, next: ResourceState<unknown>) {
  if (records.get(key) !== record) return;
  record.state = next;
  record.listeners.forEach((listener) => listener());
}

function pruneRecord(key: string, record: KeyRecord) {
  if (
    record.listeners.size === 0 &&
    record.revalidators.size === 0 &&
    record.inflight === null &&
    record.state === EMPTY_STATE &&
    records.get(key) === record
  ) {
    records.delete(key);
  }
}

function evictIfNeeded() {
  if (records.size <= MAX_ENTRIES) return;
  const evictable = Array.from(records.entries())
    .filter(
      ([, record]) =>
        record.listeners.size === 0 && record.revalidators.size === 0 && record.inflight === null,
    )
    .sort(([, a], [, b]) => a.state.updatedAt - b.state.updatedAt);
  for (const [key] of evictable) {
    if (records.size <= MAX_ENTRIES) break;
    records.delete(key);
  }
}

type KeyMatcher = string | ((key: string) => boolean);

function matches(matcher: KeyMatcher | undefined, key: string): boolean {
  if (matcher === undefined) return true;
  return typeof matcher === "function" ? matcher(key) : key.startsWith(matcher);
}

/** Structural equality for JSON-like API data, so unchanged refetches keep the same reference. */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(b)) return false;
  const protoA = Object.getPrototypeOf(a);
  if (protoA !== Object.prototype && protoA !== null) return false;
  if (Object.getPrototypeOf(b) !== protoA) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!isDeepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

function isUnauthorized(error: unknown): boolean {
  // Duck-typed: any error object with `status: 401` (see HttpError below).
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { status?: unknown }).status === 401
  );
}

/** Error thrown by {@link fetchJson} for non-2xx responses (`status` drives 401 handling). */
export class HttpError extends Error {
  constructor(
    public status: number,
    message?: string,
    public body?: unknown,
  ) {
    super(message ?? `HTTP ${status}`);
    this.name = "HttpError";
  }
}

/**
 * GET (or other method) a same-origin JSON route handler and throw an
 * {@link HttpError} on non-2xx. Use it inside `useCachedResource` fetchers.
 * Never call backend services directly from the browser; go through
 * `src/app/api/**` routes that read the httpOnly session cookie.
 */
export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new HttpError(response.status, `HTTP ${response.status} ${input}`, body);
  }
  return (await response.json()) as T;
}

type UnauthorizedHandler = (error: unknown) => void;

const defaultUnauthorizedHandler: UnauthorizedHandler = () => {
  clearResourceCache(undefined, { revalidate: false });
  if (typeof window === "undefined" || window.location.pathname === "/login") return;
  const next = window.location.pathname + window.location.search;
  void fetch("/api/auth/logout", { method: "POST" })
    .catch(() => undefined)
    .finally(() => {
      window.location.assign(next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login");
    });
};

let unauthorizedHandler: UnauthorizedHandler = defaultUnauthorizedHandler;
let unauthorizedNotified = false;

/**
 * Replace what happens when a fetcher fails with 401 (tests, or a page that
 * wants to show a "session expired" sheet instead). Pass null to restore the
 * default (clear cache + redirect to "/"). The handler runs at most once until
 * {@link resetUnauthorizedState} or a later successful fetch.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler ?? defaultUnauthorizedHandler;
  unauthorizedNotified = false;
}

/** Allow the unauthorized handler to run again (e.g. after re-login without a reload). */
export function resetUnauthorizedState(): void {
  unauthorizedNotified = false;
}

async function runWithSessionCheck<T>(fetcher: () => Promise<T>): Promise<T> {
  try {
    const value = await fetcher();
    unauthorizedNotified = false;
    return value;
  } catch (error) {
    if (isUnauthorized(error) && !unauthorizedNotified) {
      unauthorizedNotified = true;
      // Let the failing request settle first so the entry stores the error.
      setTimeout(() => unauthorizedHandler(error), 0);
    }
    throw error;
  }
}

/** Read the current snapshot for a key (stable reference until it changes). */
export function getResourceState<T>(key: string): ResourceState<T> {
  return (records.get(key)?.state ?? EMPTY_STATE) as ResourceState<T>;
}

/** Cached data for a key, if any. Handy for seeding a related screen. */
export function peekResource<T>(key: string): T | undefined {
  return getResourceState<T>(key).data;
}

/** Subscribe to changes of one key. Returns the unsubscribe function. */
export function subscribeResource(key: string, listener: Listener): () => void {
  const record = getRecord(key);
  record.listeners.add(listener);
  return () => {
    record.listeners.delete(listener);
    pruneRecord(key, record);
  };
}

/**
 * Fetch a key into the cache, deduplicating with any in-flight request.
 * Never rejects: errors are stored on the entry and the promise resolves undefined.
 * No-op on the server (the store must never hold one user's data across requests).
 */
export function fetchResource<T>(key: string, fetcher: () => Promise<T>): Promise<T | undefined> {
  if (typeof window === "undefined") return Promise.resolve(undefined);

  const record = getRecord(key);
  if (record.inflight) {
    return (record.inflight as Promise<T>).then(
      (value) => value,
      () => undefined,
    );
  }

  const generation = record.generation;
  setState(key, record, { ...record.state, isValidating: true });

  const request = runWithSessionCheck(fetcher);
  record.inflight = request;

  const settle = (apply: () => void) => {
    if (record.inflight === request) record.inflight = null;
    if (record.generation !== generation || records.get(key) !== record) {
      // Invalidated or cleared while in flight: drop this result.
      pruneRecord(key, record);
      return;
    }
    apply();
    evictIfNeeded();
  };

  return request.then(
    (value) => {
      settle(() => {
        const previous = record.state.data;
        const data = previous !== undefined && isDeepEqual(previous, value) ? previous : value;
        setState(key, record, { data, error: undefined, updatedAt: Date.now(), isValidating: false });
      });
      return value;
    },
    (error: unknown) => {
      settle(() => {
        setState(key, record, { ...record.state, error, isValidating: false });
      });
      return undefined;
    },
  );
}

/**
 * Warm the cache (e.g. on press-in of a link) unless the entry is still fresh.
 * Resolves with the cached or fetched data.
 */
export function prefetchResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  staleTime: number = DEFAULT_STALE_TIME_MS,
): Promise<T | undefined> {
  const state = getResourceState<T>(key);
  if (state.updatedAt > 0 && Date.now() - state.updatedAt < staleTime) {
    return Promise.resolve(state.data);
  }
  return fetchResource(key, fetcher);
}

/** Set cached data for a key locally (optimistic update). Notifies every subscriber. */
export function mutateResource<T>(key: string, next: ResourceUpdater<T>): void {
  if (typeof window === "undefined") return;
  const record = getRecord(key);
  const current = record.state.data as T | undefined;
  const data = typeof next === "function" ? (next as (current: T | undefined) => T)(current) : next;
  // A request started before this change would overwrite it with older data.
  record.generation += 1;
  record.inflight = null;
  setState(key, record, { data, error: undefined, updatedAt: Date.now(), isValidating: false });
}

function revalidateMounted(record: KeyRecord) {
  // Hooks for one key share the request, so the first registered fetcher is enough.
  const first = record.revalidators.values().next();
  if (!first.done) first.value();
}

/**
 * Mark matching entries stale and refetch the ones currently on screen.
 * Cached data stays visible until fresh data arrives. Use after any
 * mutation (server action / POST) that changes server data.
 *
 * @param keyOrPrefix exact key, string prefix (e.g. `${userId}:classes:`), or predicate.
 */
export function invalidateResource(keyOrPrefix: KeyMatcher): void {
  const affected: KeyRecord[] = [];
  records.forEach((record, key) => {
    if (!matches(keyOrPrefix, key)) return;
    record.generation += 1;
    record.inflight = null;
    affected.push(record);
    setState(key, record, { ...record.state, updatedAt: 0, isValidating: false });
  });
  affected.forEach(revalidateMounted);
}

export interface ClearResourceCacheOptions {
  /** Refetch entries that are still on screen. Default true; pass false right before leaving (logout). */
  revalidate?: boolean;
}

/**
 * Drop cached data (all entries, or those matching `prefix`). Screens that are
 * still mounted refetch from scratch unless `revalidate: false`. Called by
 * the app shell on logout and when the signed-in admin changes, so one admin
 * never sees another's data.
 */
export function clearResourceCache(
  prefix?: KeyMatcher,
  { revalidate = true }: ClearResourceCacheOptions = {},
): void {
  const affected: KeyRecord[] = [];
  Array.from(records.entries()).forEach(([key, record]) => {
    if (!matches(prefix, key)) return;
    record.generation += 1;
    record.inflight = null;
    setState(key, record, EMPTY_STATE);
    if (record.listeners.size === 0 && record.revalidators.size === 0) {
      records.delete(key);
    } else {
      affected.push(record);
    }
  });
  if (revalidate) affected.forEach(revalidateMounted);
}

function isFresh(state: ResourceState<unknown>, staleTime: number): boolean {
  return state.updatedAt > 0 && Date.now() - state.updatedAt < staleTime;
}

const noopUnsubscribe = () => {};
const getEmptySnapshot = () => EMPTY_STATE;

/**
 * Stale-while-revalidate data hook.
 *
 * @example
 * const { userId } = useAdminSession(); // from AdminShell (@/components/app)
 * const { data, error, isLoading, refetch } = useCachedResource(
 *   `${userId}:classes`,
 *   () => fetchJson<ClassSummary[]>("/api/classes"),
 * );
 * if (isLoading) return <ListSkeleton />;
 * if (error && !data) return <ErrorState onRetry={refetch} />;
 *
 * - `key === null` or `enabled === false` → idle (no fetching, isLoading false).
 * - `fetcher` may change identity every render; the latest one is used.
 */
export function useCachedResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: CachedResourceOptions = {},
): CachedResource<T> {
  const {
    enabled = true,
    staleTime = DEFAULT_STALE_TIME_MS,
    revalidateOnFocus = true,
    keepPreviousData = false,
  } = options;
  const active = key !== null && enabled;

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const subscribe = useCallback(
    (onChange: Listener) => (key === null ? noopUnsubscribe : subscribeResource(key, onChange)),
    [key],
  );
  const getSnapshot = useCallback(
    () => (key === null ? EMPTY_STATE : getResourceState<T>(key)),
    [key],
  );
  const state = useSyncExternalStore(subscribe, getSnapshot, getEmptySnapshot) as ResourceState<T>;

  // Revalidate on mount / key change when stale, and register for invalidation.
  useEffect(() => {
    if (!active || key === null) return;
    const revalidate = () => {
      void fetchResource(key, () => fetcherRef.current());
    };
    const record = getRecord(key);
    record.revalidators.add(revalidate);
    if (!isFresh(record.state, staleTime)) revalidate();
    return () => {
      record.revalidators.delete(revalidate);
      pruneRecord(key, record);
    };
  }, [active, key, staleTime]);

  // Revalidate when the tab comes back to the foreground.
  useEffect(() => {
    if (!active || key === null || !revalidateOnFocus) return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!isFresh(getResourceState(key), staleTime)) {
        void fetchResource(key, () => fetcherRef.current());
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [active, key, revalidateOnFocus, staleTime]);

  // Remember the last key that had data, for keepPreviousData.
  const previousRef = useRef<{ key: string; data: T } | null>(null);
  useEffect(() => {
    if (key !== null && state.data !== undefined) {
      previousRef.current = { key, data: state.data };
    }
  }, [key, state.data]);

  const previous = previousRef.current;
  const isPreviousData =
    keepPreviousData &&
    key !== null &&
    state.data === undefined &&
    previous !== null &&
    previous.key !== key;
  const data = isPreviousData && previous ? previous.data : state.data;

  const refetch = useCallback(
    () => (key === null ? Promise.resolve(undefined) : fetchResource(key, () => fetcherRef.current())),
    [key],
  );

  const mutate = useCallback(
    (next: ResourceUpdater<T>, mutateOptions?: MutateOptions) => {
      if (key === null) return;
      mutateResource(key, next);
      if (mutateOptions?.revalidate) void fetchResource(key, () => fetcherRef.current());
    },
    [key],
  );

  const isLoading = active && data === undefined && state.error === undefined;

  return useMemo(
    () => ({
      data,
      error: state.error,
      isLoading,
      isValidating: state.isValidating,
      isPreviousData,
      refetch,
      mutate,
    }),
    [data, state.error, isLoading, state.isValidating, isPreviousData, refetch, mutate],
  );
}
