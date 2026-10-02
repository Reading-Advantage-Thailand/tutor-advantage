/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, downloadBlob, fetchBlobWithAuth, fetchWithAuth, messageFor } from "./api";

describe("admin API helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("routes requests through the Next.js proxy and sets Content-Type", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(fetchWithAuth("/v1/settlements")).resolves.toEqual({ ok: true });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/proxy/v1/settlements");
    expect((init?.headers as Headers).get("Content-Type")).toBe("application/json");
    // No Authorization header — the proxy reads the httpOnly cookie server-side
    expect((init?.headers as Headers).has("Authorization")).toBe(false);
  });

  it("throws a nested API error message", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(fetchWithAuth("/v1/admin-only")).rejects.toThrow("Forbidden");
  });

  it("does not set JSON content type for FormData bodies", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await fetchWithAuth("/v1/upload", { method: "POST", body: new FormData() });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Headers).has("Content-Type")).toBe(false);
  });

  it("returns blobs from blob requests", async () => {
    const blob = new Blob(["hello"]);
    const mockResponse = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      blob: () => Promise.resolve(blob),
    } as unknown as Response;
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    await expect(fetchBlobWithAuth("/v1/documents/file")).resolves.toBeInstanceOf(Blob);
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

  it("maps backend error codes to Thai messages and keeps the code", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "DRAFT_EXISTS", message: "Draft exists", requestId: "r1" } }), {
        status: 409,
        headers: { "content-type": "application/json" },
      })
    );
    const error = (await api.post("/v1/settlements/preview", { periodMonth: "2026-09" }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe("DRAFT_EXISTS");
    expect(error.requestId).toBe("r1");
    expect(error.message).toContain("ฉบับร่าง");
  });

  it("falls back to Thai status messages for generic server errors", () => {
    expect(messageFor(500, null, "Internal Server Error")).toBe("ระบบขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง");
    expect(messageFor(403, null, null)).toBe("คุณไม่มีสิทธิ์ทำรายการนี้");
    expect(messageFor(0, null, null)).toContain("เชื่อมต่อ");
  });

  it("sends an idempotency key on mutations only, JSON body and query params", async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } })
    );
    await api.get("/v1/coupons", { query: { page: 2, status: "", q: undefined } });
    await api.post("/v1/coupons", { hours: 3 });
    await api.post("/v1/coupons/abc/void", undefined, { idempotencyKey: "fixed-key-123" });
    const [getUrl, getInit] = vi.mocked(fetch).mock.calls[0];
    expect(getUrl).toBe("/api/proxy/v1/coupons?page=2");
    expect((getInit?.headers as Headers).has("Idempotency-Key")).toBe(false);
    const [, postInit] = vi.mocked(fetch).mock.calls[1];
    expect((postInit?.headers as Headers).get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(postInit?.body).toBe(JSON.stringify({ hours: 3 }));
    const [, voidInit] = vi.mocked(fetch).mock.calls[2];
    expect((voidInit?.headers as Headers).get("Idempotency-Key")).toBe("fixed-key-123");
  });

  it("turns network failures into a Thai ApiError with status 0", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api.get("/v1/admin/overview")).rejects.toMatchObject({ status: 0, name: "ApiError" });
  });
});
