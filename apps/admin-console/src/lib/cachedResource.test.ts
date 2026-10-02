// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  clearResourceCache,
  fetchResource,
  getResourceState,
  invalidateResource,
  mutateResource,
  peekResource,
  prefetchResource,
  setUnauthorizedHandler,
  useCachedResource,
  fetchJson,
  HttpError,
  type CachedResource,
  type CachedResourceOptions,
} from "./cachedResource";

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class FakeApiError extends Error {
  constructor(public status: number) {
    super(`API Error ${status}`);
  }
}

const onUnauthorized = vi.fn<(error: unknown) => void>();

let container: HTMLDivElement;
let root: Root;

type HookProps<T> = {
  hookKey: string | null;
  fetcher: () => Promise<T>;
  options?: CachedResourceOptions;
  results: CachedResource<T>[];
};

function HookProbe<T>({ hookKey, fetcher, options, results }: HookProps<T>) {
  results.push(useCachedResource(hookKey, fetcher, options));
  return null;
}

async function renderHook<T>(props: HookProps<T>, target: Root = root) {
  await act(async () => {
    target.render(React.createElement(HookProbe as (p: HookProps<T>) => null, props));
  });
}

const last = <T,>(results: CachedResource<T>[]) => results[results.length - 1]!;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  setUnauthorizedHandler(onUnauthorized);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  clearResourceCache(undefined, { revalidate: false });
  vi.useRealTimers();
});

describe("fetchResource (store)", () => {
  it("dedupes concurrent requests for the same key", async () => {
    const request = deferred<{ n: number }>();
    const fetcher = vi.fn(() => request.promise);

    const a = fetchResource("u1:dashboard", fetcher);
    const b = fetchResource("u1:dashboard", fetcher);
    expect(getResourceState("u1:dashboard").isValidating).toBe(true);
    request.resolve({ n: 1 });

    await expect(Promise.all([a, b])).resolves.toEqual([{ n: 1 }, { n: 1 }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(peekResource("u1:dashboard")).toEqual({ n: 1 });
    expect(getResourceState("u1:dashboard").isValidating).toBe(false);
    expect(getResourceState("u1:dashboard").updatedAt).toBeGreaterThan(0);
  });

  it("stores errors without rejecting and keeps the previous data", async () => {
    await fetchResource("u1:classes", async () => ["a"]);
    const error = new Error("boom");

    await expect(fetchResource("u1:classes", async () => { throw error; })).resolves.toBeUndefined();

    const state = getResourceState<string[]>("u1:classes");
    expect(state.data).toEqual(["a"]);
    expect(state.error).toBe(error);
  });

  it("keeps the same data reference when a refetch returns equal data", async () => {
    await fetchResource("u1:chat", async () => ({ items: [{ id: 1, text: "hi" }] }));
    const first = peekResource("u1:chat");

    await fetchResource("u1:chat", async () => ({ items: [{ id: 1, text: "hi" }] }));
    expect(peekResource("u1:chat")).toBe(first);

    await fetchResource("u1:chat", async () => ({ items: [{ id: 1, text: "hello" }] }));
    expect(peekResource("u1:chat")).not.toBe(first);
  });

  it("prefetchResource skips the network while the entry is fresh", async () => {
    const fetcher = vi.fn(async () => 1);
    await prefetchResource("u1:progress:a", fetcher);
    await prefetchResource("u1:progress:a", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await prefetchResource("u1:progress:a", fetcher, 0);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("drops a result that was invalidated while in flight", async () => {
    const stale = deferred<string>();
    const staleRequest = fetchResource("u1:summary", () => stale.promise);

    invalidateResource("u1:summary");
    await fetchResource("u1:summary", async () => "fresh");
    stale.resolve("stale");
    await staleRequest;

    expect(peekResource("u1:summary")).toBe("fresh");
  });

  it("mutateResource wins over a request that started before it", async () => {
    const request = deferred<string>();
    const pending = fetchResource("u1:settings", () => request.promise);

    mutateResource("u1:settings", "optimistic");
    request.resolve("server-before-change");
    await pending;

    expect(peekResource("u1:settings")).toBe("optimistic");
  });
});

describe("401 handling", () => {
  it("stores the 401, does not retry, and calls the unauthorized handler once", async () => {
    const unauthorized = new FakeApiError(401);
    const fetcher = vi.fn(async () => { throw unauthorized; });

    await fetchResource("u1:a", fetcher);
    await fetchResource("u1:b", fetcher);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getResourceState("u1:a").error).toBe(unauthorized);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledWith(unauthorized);
  });

  it("does not call the handler for other errors", async () => {
    const fetcher = vi.fn(async () => { throw new FakeApiError(500); });

    await fetchResource("u1:d", fetcher);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("fetchJson", () => {
  it("returns parsed JSON and throws HttpError with status on failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "x" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(fetchJson("/api/a")).resolves.toEqual({ ok: 1 });
      const error = await fetchJson("/api/b").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(401);
      expect((error as HttpError).body).toEqual({ error: "x" });
      expect(fetchMock).toHaveBeenCalledWith("/api/a", { cache: "no-store" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("useCachedResource", () => {
  it("is idle for a null key or when disabled", async () => {
    const fetcher = vi.fn(async () => "x");
    const results: CachedResource<string>[] = [];

    await renderHook({ hookKey: null, fetcher, results });
    expect(last(results)).toMatchObject({ data: undefined, isLoading: false, isValidating: false });

    await renderHook({ hookKey: "u1:idle", fetcher, options: { enabled: false }, results });
    expect(last(results)).toMatchObject({ data: undefined, isLoading: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads, then serves cached data instantly on remount without refetching while fresh", async () => {
    const fetcher = vi.fn(async () => ({ name: "Nong" }));
    const results: CachedResource<{ name: string }>[] = [];

    await renderHook({ hookKey: "u1:profile", fetcher, results });
    expect(results[0]).toMatchObject({ data: undefined, isLoading: true });
    expect(last(results)).toMatchObject({ data: { name: "Nong" }, isLoading: false, isValidating: false });

    await act(async () => root.unmount());
    root = createRoot(container);
    const remount: CachedResource<{ name: string }>[] = [];
    await renderHook({ hookKey: "u1:profile", fetcher, results: remount });

    expect(remount[0]).toMatchObject({ data: { name: "Nong" }, isLoading: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("shows stale data immediately and revalidates in the background", async () => {
    await fetchResource("u1:dash", async () => "old");
    const next = deferred<string>();
    const fetcher = vi.fn(() => next.promise);
    const results: CachedResource<string>[] = [];

    await renderHook({ hookKey: "u1:dash", fetcher, options: { staleTime: 0 }, results });
    expect(results[0]).toMatchObject({ data: "old", isLoading: false });
    expect(last(results)).toMatchObject({ data: "old", isValidating: true });

    await act(async () => next.resolve("new"));
    expect(last(results)).toMatchObject({ data: "new", isValidating: false });
  });

  it("shares one request and the data between components using the same key", async () => {
    const request = deferred<number>();
    const fetcher = vi.fn(() => request.promise);
    const a: CachedResource<number>[] = [];
    const b: CachedResource<number>[] = [];
    const second = document.createElement("div");
    const secondRoot = createRoot(second);

    await renderHook({ hookKey: "u1:shared", fetcher, results: a });
    await renderHook({ hookKey: "u1:shared", fetcher, results: b }, secondRoot);
    await act(async () => request.resolve(7));

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(last(a).data).toBe(7);
    expect(last(b).data).toBe(7);

    await act(async () => last(a).mutate(8));
    expect(last(b).data).toBe(8);
    await act(async () => secondRoot.unmount());
  });

  it("exposes errors, stops loading, and recovers with refetch", async () => {
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("back");
    const results: CachedResource<string>[] = [];

    await renderHook({ hookKey: "u1:err", fetcher, results });
    expect(last(results)).toMatchObject({ isLoading: false, data: undefined });
    expect(last(results).error).toBeInstanceOf(Error);

    let refetched: string | undefined;
    await act(async () => { refetched = await last(results).refetch(); });
    expect(refetched).toBe("back");
    expect(last(results)).toMatchObject({ data: "back", error: undefined });
  });

  it("invalidateResource refetches mounted screens and marks others stale", async () => {
    let version = 0;
    const fetcher = vi.fn(async () => ++version);
    const results: CachedResource<number>[] = [];
    await renderHook({ hookKey: "u1:progress:c1", fetcher, results });
    await fetchResource("u1:progress:c2", async () => 100);
    await fetchResource("u1:dashboard", async () => 5);

    await act(async () => invalidateResource("u1:progress:"));

    expect(last(results).data).toBe(2);
    expect(getResourceState("u1:progress:c2")).toMatchObject({ data: 100, updatedAt: 0 });
    expect(getResourceState("u1:dashboard").updatedAt).toBeGreaterThan(0);

    // The unmounted entry revalidates on its next mount even inside staleTime.
    const c2Fetcher = vi.fn(async () => 101);
    const other = document.createElement("div");
    const otherRoot = createRoot(other);
    const c2: CachedResource<number>[] = [];
    await renderHook({ hookKey: "u1:progress:c2", fetcher: c2Fetcher, results: c2 }, otherRoot);
    expect(c2[0]!.data).toBe(100);
    expect(last(c2).data).toBe(101);
    await act(async () => otherRoot.unmount());
  });

  it("clearResourceCache drops data and mounted screens load again", async () => {
    let version = 0;
    const fetcher = vi.fn(async () => `v${++version}`);
    const results: CachedResource<string>[] = [];
    await renderHook({ hookKey: "u1:home", fetcher, results });
    await fetchResource("u2:home", async () => "other student");

    await act(async () => clearResourceCache());

    expect(peekResource("u2:home")).toBeUndefined();
    expect(last(results).data).toBe("v2");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("clearResourceCache with revalidate:false leaves mounted screens empty", async () => {
    const fetcher = vi.fn(async () => "data");
    const results: CachedResource<string>[] = [];
    await renderHook({ hookKey: "u1:bye", fetcher, results });

    await act(async () => clearResourceCache("u1:", { revalidate: false }));

    expect(last(results).data).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keepPreviousData returns the previous key's data while the new key loads", async () => {
    const next = deferred<string[]>();
    const fetcher = vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(["all"])
      .mockReturnValueOnce(next.promise);
    const results: CachedResource<string[]>[] = [];
    const options = { keepPreviousData: true };

    await renderHook({ hookKey: "u1:classes::", fetcher, options, results });
    await renderHook({ hookKey: "u1:classes:A1:", fetcher, options, results });
    expect(last(results)).toMatchObject({ data: ["all"], isPreviousData: true, isLoading: false, isValidating: true });

    await act(async () => next.resolve(["a1"]));
    expect(last(results)).toMatchObject({ data: ["a1"], isPreviousData: false });
  });

  it("uses the latest fetcher closure", async () => {
    const results: CachedResource<string>[] = [];
    await renderHook({ hookKey: "u1:q", fetcher: async () => "first", results });
    await renderHook({ hookKey: "u1:q", fetcher: async () => "second", results });

    await act(async () => { await last(results).refetch(); });
    expect(last(results).data).toBe("second");
  });

  it("revalidates stale data when the page becomes visible again", async () => {
    let version = 0;
    const fetcher = vi.fn(async () => ++version);
    const results: CachedResource<number>[] = [];
    await renderHook({ hookKey: "u1:focus", fetcher, options: { staleTime: 60_000 }, results });

    await act(async () => setVisibility("visible"));
    expect(fetcher).toHaveBeenCalledTimes(1);

    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
    await act(async () => setVisibility("visible"));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(last(results).data).toBe(2);
  });

  it("does not revalidate on focus when revalidateOnFocus is false", async () => {
    const fetcher = vi.fn(async () => 1);
    await renderHook({ hookKey: "u1:nofocus", fetcher, options: { staleTime: 0, revalidateOnFocus: false }, results: [] });

    await act(async () => setVisibility("visible"));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
