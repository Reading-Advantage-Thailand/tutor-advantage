/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, fetchBlobWithAuth, fetchWithAuth } from "./api";

describe("admin API helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("prefixes finance API URLs, attaches token, and parses JSON responses", async () => {
    localStorage.setItem("admin_token", "admin-token");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(fetchWithAuth("/settlements")).resolves.toEqual({ ok: true });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("http://localhost:3003/settlements");
    expect((init?.headers as Headers).get("Authorization")).toBe("Bearer admin-token");
    expect((init?.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("throws a nested API error message", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(fetchWithAuth("/admin-only")).rejects.toThrow("Forbidden");
  });

  it("does not set JSON content type for FormData bodies", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await fetchWithAuth("/upload", { method: "POST", body: new FormData() });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Headers).has("Content-Type")).toBe(false);
  });

  it("returns blobs from blob requests", async () => {
    const blob = new Blob(["hello"]);
    // jsdom's Blob lacks .stream() — mock the Response directly instead
    const mockResponse = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      blob: () => Promise.resolve(blob),
    } as unknown as Response;
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    await expect(fetchBlobWithAuth("/documents/file")).resolves.toBeInstanceOf(Blob);
  });

  it("downloads blobs through a temporary anchor element", () => {
    const createObjectURL = vi.fn(() => "blob:download");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const anchor = document.createElement("a");
    anchor.click = click;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    downloadBlob(new Blob(["hello"]), "report.csv");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download");
  });
});
