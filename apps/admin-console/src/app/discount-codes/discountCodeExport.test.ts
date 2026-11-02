import { describe, expect, it } from "vitest";
import { buildCodesCsv, buildCodesText, codesCsvFilename, CSV_BOM, csvCell } from "./discountCodeExport";

const headers = {
  index: "ลำดับ",
  code: "โค้ด",
  sentTo: "ส่งให้ (ชื่อนักเรียน)",
  message: "ข้อความสำหรับส่งนักเรียน",
};
const message = (code: string) => `เปิดคลาส "English, ป.4" → กดสมัคร/ชำระเงิน → ใส่โค้ด ${code} → ยืนยันชำระเงิน ฿0`;

describe("buildCodesText (คัดลอกทั้งหมด)", () => {
  it("puts one numbered code per line, in batch order", () => {
    expect(buildCodesText(["DC-AAAA-1111", "DC-BBBB-2222", "DC-CCCC-3333"])).toBe(
      "1. DC-AAAA-1111\n2. DC-BBBB-2222\n3. DC-CCCC-3333",
    );
    expect(buildCodesText([])).toBe("");
  });
});

describe("buildCodesCsv (ดาวน์โหลด CSV)", () => {
  const csv = buildCodesCsv(
    ["DC-AAAA-1111", "DC-BBBB-2222"].map((code) => ({ code, message: message(code) })),
    headers,
  );

  it("starts with a UTF-8 BOM so Excel reads the Thai text", () => {
    expect(CSV_BOM).toBe("\uFEFF");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(new TextEncoder().encode(csv).slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
  });

  it("writes the Thai header row, one numbered row per code and a blank ส่งให้ column", () => {
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toEqual([
      "ลำดับ,โค้ด,ส่งให้ (ชื่อนักเรียน),ข้อความสำหรับส่งนักเรียน",
      `1,DC-AAAA-1111,,"เปิดคลาส ""English, ป.4"" → กดสมัคร/ชำระเงิน → ใส่โค้ด DC-AAAA-1111 → ยืนยันชำระเงิน ฿0"`,
      `2,DC-BBBB-2222,,"เปิดคลาส ""English, ป.4"" → กดสมัคร/ชำระเงิน → ใส่โค้ด DC-BBBB-2222 → ยืนยันชำระเงิน ฿0"`,
      "",
    ]);
  });

  it("writes only the header for an empty batch", () => {
    expect(buildCodesCsv([], headers)).toBe(`\uFEFFลำดับ,โค้ด,ส่งให้ (ชื่อนักเรียน),ข้อความสำหรับส่งนักเรียน\r\n`);
  });
});

describe("csvCell", () => {
  it("quotes commas, quotes and line breaks only when needed", () => {
    expect(csvCell("DC-AAAA-1111")).toBe("DC-AAAA-1111");
    expect(csvCell("คลาสภาษาอังกฤษ")).toBe("คลาสภาษาอังกฤษ");
    expect(csvCell(3)).toBe("3");
    expect(csvCell("")).toBe("");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvCell("line 1\r\nline 2")).toBe('"line 1\r\nline 2"');
  });

  it("keeps a spreadsheet from running text as a formula", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+66812345678")).toBe("'+66812345678");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@me")).toBe("'@me");
    expect(csvCell(-1)).toBe("-1");
  });
});

describe("codesCsvFilename", () => {
  it("uses the Bangkok date", () => {
    // 2 Nov 2026 23:30 Bangkok = 16:30 UTC
    expect(codesCsvFilename(new Date("2026-11-02T16:30:00Z"))).toBe("discount-codes-2026-11-02.csv");
    // 3 Nov 2026 00:30 Bangkok
    expect(codesCsvFilename(new Date("2026-11-02T17:30:00Z"))).toBe("discount-codes-2026-11-03.csv");
  });
});
