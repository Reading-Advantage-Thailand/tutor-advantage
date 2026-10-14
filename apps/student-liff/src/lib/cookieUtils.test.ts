/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Cookies,
  SESSION_CONFIRMATION_TTL_MS,
  isSessionConfirmed,
  markSessionReady,
  resetSessionProbe,
  waitForSession,
} from "./cookieUtils";

describe("Cookies", () => {
  beforeEach(() => {
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0]?.trim();
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
  });

  it("sets and reads encoded cookie values", () => {
    Cookies.set("session token", "a value with spaces");

    expect(Cookies.get("session token")).toBe("a value with spaces");
    expect(document.cookie).toContain("session%20token=a%20value%20with%20spaces");
  });

  it("removes cookies by expiring them", () => {
    Cookies.set("token", "abc");
    Cookies.remove("token");

    expect(Cookies.get("token")).toBeNull();
  });
});

function sessionResponse(authenticated: boolean) {
  return new Response(JSON.stringify({ authenticated }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("waitForSession", () => {
  beforeEach(() => {
    resetSessionProbe();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetSessionProbe();
  });

  it("probes the server once, then remembers a confirmed session", async () => {
    vi.mocked(fetch).mockResolvedValue(sessionResponse(true));

    await expect(waitForSession()).resolves.toBe(true);
    await expect(waitForSession()).resolves.toBe(true);
    await expect(waitForSession(20, 250)).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    expect(isSessionConfirmed()).toBe(true);
  });

  it("returns immediately after markSessionReady without any request", async () => {
    markSessionReady();

    await expect(waitForSession()).resolves.toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("probes again once the confirmation TTL has expired", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(sessionResponse(true));

    markSessionReady();
    vi.advanceTimersByTime(SESSION_CONFIRMATION_TTL_MS + 1);
    expect(isSessionConfirmed()).toBe(false);

    await expect(waitForSession()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("resetSessionProbe forgets the confirmed session", async () => {
    vi.mocked(fetch).mockResolvedValue(sessionResponse(true));
    markSessionReady();
    resetSessionProbe();

    expect(isSessionConfirmed()).toBe(false);
    await expect(waitForSession()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries until the session exists and never caches a negative result", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(sessionResponse(false))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(sessionResponse(true));

    const result = waitForSession(5, 100);
    await vi.advanceTimersByTimeAsync(250);

    await expect(result).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("gives up after maxRetries without waiting after the final attempt", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => sessionResponse(false));

    const result = waitForSession(3, 100);
    await vi.advanceTimersByTimeAsync(200);

    await expect(result).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(isSessionConfirmed()).toBe(false);

    // A later call probes again because failures are not remembered.
    vi.mocked(fetch).mockImplementation(async () => sessionResponse(true));
    await expect(waitForSession(1, 100)).resolves.toBe(true);
  });

  it("shares one in-flight probe between concurrent callers", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    vi.mocked(fetch).mockImplementation(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; }),
    );

    const first = waitForSession();
    const second = waitForSession();
    resolveFetch(sessionResponse(true));

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stops polling as soon as markSessionReady is called mid-probe", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => sessionResponse(false));

    const result = waitForSession(10, 500);
    await vi.advanceTimersByTimeAsync(0);
    markSessionReady();
    await vi.advanceTimersByTimeAsync(500);

    await expect(result).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("a probe started before resetSessionProbe cannot confirm the next session", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    vi.mocked(fetch).mockImplementation(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; }),
    );

    const stale = waitForSession();
    resetSessionProbe();
    resolveFetch(sessionResponse(true));

    await expect(stale).resolves.toBe(true);
    expect(isSessionConfirmed()).toBe(false);
  });
});
