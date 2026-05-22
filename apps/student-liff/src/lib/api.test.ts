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
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("uses browser proxy URLs and attaches the stored session token", async () => {
    localStorage.setItem("student_session_token", "token-1");
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

  it("stores the session token after LINE login", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ sessionToken: "new-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { studentApi } = await import("./api");

    await studentApi.loginWithLine("id-token");

    expect(localStorage.getItem("student_session_token")).toBe("new-token");
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
