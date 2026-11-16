import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { keepThaiWords, ThaiText } from "./ThaiText";

describe("keepThaiWords", () => {
  it("wraps each listed compound in a no-wrap span and keeps every character", () => {
    const html = renderToStaticMarkup(<>{keepThaiWords("ให้ผู้ปกครองรับทราบ จ่ายด้วยพร้อมเพย์นะ")}</>);
    expect(html).toBe(
      'ให้<span class="whitespace-nowrap">ผู้ปกครอง</span>รับทราบ จ่ายด้วย<span class="whitespace-nowrap">พร้อมเพย์</span>นะ',
    );
  });

  it("returns text without a listed compound unchanged", () => {
    expect(keepThaiWords("โค้ดนี้หมดเวลาแล้ว")).toBe("โค้ดนี้หมดเวลาแล้ว");
  });
});

describe("ThaiText", () => {
  it("renders a balanced block span with the short last word glued on", () => {
    const html = renderToStaticMarkup(<ThaiText text="ใช้โค้ดแล้ว ลด 50" className="min-w-0" />);
    expect(html).toBe('<span class="block text-balance min-w-0">ใช้โค้ดแล้ว ลด 50</span>');
  });
});
