// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mocks = vi.hoisted(() => ({
  liff: {
    use: vi.fn(),
    init: vi.fn<(config: unknown) => Promise<void>>(),
    isLoggedIn: vi.fn<() => boolean>(),
    isInClient: vi.fn<() => boolean>(),
    getIDToken: vi.fn<() => string | null>(),
    getProfile: vi.fn<() => Promise<{ userId: string; displayName: string }>>(),
    login: vi.fn(),
    logout: vi.fn(),
  },
  markSessionReady: vi.fn(),
  resetSessionProbe: vi.fn(),
  clearResourceCache: vi.fn(),
}));

vi.mock("@line/liff", () => ({ default: mocks.liff }));
vi.mock("../../lib/cookieUtils", () => ({
  markSessionReady: mocks.markSessionReady,
  resetSessionProbe: mocks.resetSessionProbe,
}));
vi.mock("../../lib/cachedResource", () => ({ clearResourceCache: mocks.clearResourceCache }));

import { LiffProvider, useLiff, type LiffContextType } from "./LiffProvider";

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

function idToken(expSecondsFromNow: number) {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let container: HTMLDivElement;
let root: Root;
let ctx: LiffContextType;
let fetchMock: ReturnType<typeof vi.fn>;
let beacon: ReturnType<typeof vi.fn>;

function Probe() {
  ctx = useLiff();
  return null;
}

async function mount() {
  await act(async () => {
    root.render(React.createElement(LiffProvider, null, React.createElement(Probe)));
  });
}

const flush = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

const beaconStages = () =>
  beacon.mock.calls.map(([, blob]) => (blob as Blob & { __body?: string }).__body ?? "").map((body) => JSON.parse(body).stage);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubEnv("NEXT_PUBLIC_LIFF_ID", "liff-test");
  vi.stubEnv("NEXT_PUBLIC_LIFF_DEBUG", "");
  for (const fn of Object.values(mocks.liff)) fn.mockReset();
  mocks.liff.init.mockResolvedValue(undefined);
  mocks.liff.isLoggedIn.mockReturnValue(true);
  mocks.liff.isInClient.mockReturnValue(true);
  mocks.liff.getIDToken.mockReturnValue(idToken(3600));
  mocks.liff.getProfile.mockResolvedValue({ userId: "U1", displayName: "Nong" });

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/auth/line") return jsonResponse({ success: true });
    return jsonResponse({ ok: true });
  });
  vi.stubGlobal("fetch", fetchMock);

  // Capture beacon bodies synchronously (Blob#text is async).
  const RealBlob = Blob;
  vi.stubGlobal(
    "Blob",
    class extends RealBlob {
      __body: string;
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        this.__body = parts.map(String).join("");
      }
    },
  );
  beacon = vi.fn(() => true);
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LiffProvider start-up", () => {
  it("runs getProfile and the session exchange in parallel; ready only after both settle", async () => {
    const profile = deferred<{ userId: string; displayName: string }>();
    const exchange = deferred<Response>();
    mocks.liff.getProfile.mockReturnValue(profile.promise);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      String(input) === "/api/auth/line" ? exchange.promise : jsonResponse({}),
    );

    await mount();
    await flush();

    // The exchange started while getProfile is still pending.
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/line", expect.objectContaining({ method: "POST" }));
    expect(ctx.isReady).toBe(false);

    await act(async () => profile.resolve({ userId: "U1", displayName: "Nong" }));
    expect(ctx.profile?.displayName).toBe("Nong");
    expect(ctx.isReady).toBe(false);

    await act(async () => exchange.resolve(jsonResponse({ success: true })));
    await flush();
    expect(ctx.isReady).toBe(true);
    expect(ctx.error).toBeNull();
    expect(ctx.errorCode).toBeNull();
    expect(mocks.markSessionReady).toHaveBeenCalledTimes(1);
    expect(mocks.clearResourceCache).toHaveBeenCalledTimes(1);
  });

  it("sends no success telemetry in production", async () => {
    await mount();
    await flush();

    expect(ctx.isReady).toBe(true);
    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/debug/client-error", expect.anything());
  });

  it("sends breadcrumbs with sendBeacon when NEXT_PUBLIC_LIFF_DEBUG=1", async () => {
    vi.stubEnv("NEXT_PUBLIC_LIFF_DEBUG", "1");
    await mount();
    await flush();

    expect(beacon).toHaveBeenCalledWith("/api/debug/client-error", expect.any(Blob));
    expect((beacon.mock.calls[0]![1] as Blob).type).toBe("application/json");
    expect(beaconStages()).toEqual([
      "liff_init_start",
      "liff_init_success",
      "auth_exchange_start",
      "auth_exchange_success",
    ]);
  });

  it("always reports failures and maps a 5xx exchange to a network error", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      String(input) === "/api/auth/line"
        ? jsonResponse({ error: "Cannot reach identity service" }, 502)
        : jsonResponse({}),
    );
    await mount();
    await flush();

    expect(ctx).toMatchObject({ isReady: true, error: "Cannot reach identity service", errorCode: "network" });
    expect(beaconStages()).toEqual(["auth_exchange_failed"]);
    expect(mocks.markSessionReady).not.toHaveBeenCalled();
  });

  it("maps a rejected exchange (4xx) to an auth error", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ error: "Invalid token" }, 401));
    await mount();
    await flush();

    expect(ctx).toMatchObject({ isReady: true, error: "Invalid token", errorCode: "auth" });
  });

  it("falls back to fetch keepalive when sendBeacon refuses", async () => {
    beacon.mockReturnValue(false);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      String(input) === "/api/auth/line" ? jsonResponse({ error: "x" }, 400) : jsonResponse({}),
    );
    await mount();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/debug/client-error",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });

  it("re-logs in when the backend says the LINE ID token expired", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      String(input) === "/api/auth/line"
        ? jsonResponse({ error: "IdToken expired.", code: "LINE_ID_TOKEN_EXPIRED" }, 401)
        : jsonResponse({}),
    );
    await mount();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(mocks.liff.logout).toHaveBeenCalled();
    expect(mocks.liff.login).toHaveBeenCalledWith({ redirectUri: window.location.href });
    expect(ctx.isReady).toBe(false);
    expect(ctx.error).toBeNull();
  });

  it("re-logs in before any network work when the ID token is about to expire", async () => {
    mocks.liff.getIDToken.mockReturnValue(idToken(30));
    await mount();
    await flush();

    expect(mocks.liff.login).toHaveBeenCalled();
    expect(mocks.liff.getProfile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/line", expect.anything());
    expect(ctx.isReady).toBe(false);
  });

  it("reports a missing ID token as an auth error", async () => {
    mocks.liff.getIDToken.mockReturnValue(null);
    await mount();
    await flush();

    expect(ctx).toMatchObject({ isReady: true, error: "LINE did not return an ID token", errorCode: "auth" });
    expect(ctx.profile?.userId).toBe("U1");
  });

  it("treats a getProfile failure like an init failure, after the exchange settles", async () => {
    mocks.liff.getProfile.mockRejectedValue(new TypeError("Failed to fetch"));
    await mount();
    await flush();

    expect(ctx.isReady).toBe(true);
    expect(ctx.errorCode).toBe("network");
    expect(ctx.error).toMatch(/^LIFF network error/);
    expect(beaconStages()).toContain("liff_init_error");
  });

  it("classifies a missing LIFF id as a config error", async () => {
    vi.stubEnv("NEXT_PUBLIC_LIFF_ID", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await mount();

    expect(ctx).toMatchObject({ isReady: true, errorCode: "config" });
    expect(mocks.liff.init).not.toHaveBeenCalled();
  });

  it("classifies LIFF SDK error codes", async () => {
    mocks.liff.init.mockRejectedValue(Object.assign(new Error("invalid liffId"), { code: "INVALID_CONFIG" }));
    await mount();
    await flush();

    expect(ctx).toMatchObject({ isReady: true, error: "invalid liffId", errorCode: "config" });
  });

  describe("logout", () => {
    // jsdom cannot load another document: sit on /login so `location.href = "/login"`
    // is a same-URL no-op instead of a "not implemented" error.
    beforeEach(() => window.history.replaceState(null, "", "/login"));
    afterEach(() => window.history.replaceState(null, "", "/"));

    it("forgets the session probe and the data cache, clears the cookie and ends the LINE login", async () => {
      await mount();
      await flush();
      mocks.resetSessionProbe.mockClear();
      mocks.clearResourceCache.mockClear();

      act(() => ctx.logout());

      expect(mocks.resetSessionProbe).toHaveBeenCalledTimes(1);
      expect(mocks.clearResourceCache).toHaveBeenCalledWith(undefined, { revalidate: false });
      expect(mocks.liff.logout).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST", keepalive: true });
      expect(ctx.profile).toBeNull();
    });

    it("still clears the session cookie when LIFF reports not logged in", async () => {
      await mount();
      await flush();
      mocks.liff.isLoggedIn.mockReturnValue(false);

      act(() => ctx.logout());

      expect(mocks.resetSessionProbe).toHaveBeenCalled();
      expect(mocks.liff.logout).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST", keepalive: true });
    });
  });
});
