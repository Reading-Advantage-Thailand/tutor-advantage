import { describe, expect, it } from "vitest";
import { t } from "./i18n";

describe("admin-console i18n", () => {
  it("returns typed API messages by key", () => {
    expect(t("api.genericError")).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    expect(t("api.status403")).toBe("คุณไม่มีสิทธิ์ทำรายการนี้");
  });

  it("fills {placeholders}", () => {
    expect(t("shell.pageOf", { page: 2, pages: 5 })).toBe("หน้า 2 จาก 5");
    expect(t("shell.rangeOf", { from: 1, to: 20 })).toBe("1–20 จาก {total} รายการ");
  });

  it("keeps every existing namespace reachable", () => {
    expect(t("layout.overview")).toBe("ภาพรวม");
    expect(t("docs.title")).toBeTruthy();
  });
});
