import { describe, expect, it, vi } from "vitest";
import { t } from "./i18n";
import "../locales/th/docs";
import "../locales/th/layout";

describe("admin-console i18n", () => {
  it("returns typed API messages by key", () => {
    expect(t("api.genericError")).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    expect(t("api.status403")).toBe("คุณไม่มีสิทธิ์ทำรายการนี้");
  });

  it("fills {placeholders}", () => {
    expect(t("shell.pageOf", { page: 2, pages: 5 })).toBe("หน้า 2 จาก 5");
    expect(t("shell.rangeOf", { from: 1, to: 20 })).toBe("1–20 จาก {total} รายการ");
  });

  it("keeps route namespaces reachable once their locale module is imported", () => {
    expect(t("layout.overview")).toBe("ภาพรวม");
    expect(t("docs.title")).toBeTruthy();
  });

  it("falls back to the key for a namespace the route did not import", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(t("voice.title")).toBe("voice.title");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
