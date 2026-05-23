/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@line/liff", () => ({
  default: {
    getIDToken: vi.fn(),
  },
}));

describe("student API helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // Reset cookies
    document.cookie = "student-session=; max-age=0; path=/";
  });

  it("uses browser proxy URLs and attaches the session token from cookie", async () => {
    document.cookie = "student-session=token-1; path=/";
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { fetchWithAuth } = await import("./api");

    await expect(fetchWithAuth("/dashboard/summary")).resolves.toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledWith("/api/learning/dashboard/summary", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer token-1",
        "Content-Type": "application/json",
      }),
    }));
  });

  it("throws API error messages from error envelopes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "No class found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    const { fetchWithAuth } = await import("./api");

    await expect(fetchWithAuth("/classes/missing")).rejects.toThrow("No class found");
  });
});
