import { describe, expect, it } from "vitest";
import { AVATAR_TONES, getAvatarTone, getInitials } from "./avatarInitials";

describe("getInitials", () => {
  it("skips a Thai leading vowel and shows only the consonant", () => {
    expect(getInitials("ใบเตย")).toBe("บ");
    expect(getInitials("เอก")).toBe("อ");
    expect(getInitials("ไอซ์ ใจดี")).toBe("อ");
    expect(getInitials("แพรว")).toBe("พ");
    expect(getInitials("โอ๊ต")).toBe("อ");
  });

  it("uses one character for Thai: the first consonant, without vowel or tone marks", () => {
    expect(getInitials("สมชาย ใจดี")).toBe("ส");
    expect(getInitials("น้ำ")).toBe("น");
    expect(getInitials("มิว")).toBe("ม");
    expect(getInitials("ต้นกล้า")).toBe("ต");
    expect(getInitials("ปุณณ์ชนิดา")).toBe("ป");
    for (const name of ["ใบเตย", "เอก", "มิว", "ต้นกล้า", "ปุณณ์ชนิดา"]) {
      expect(Array.from(getInitials(name))).toHaveLength(1);
    }
  });

  it("uses first and last initials for Latin names", () => {
    expect(getInitials("john smith")).toBe("JS");
    expect(getInitials("  Mai  ")).toBe("M");
    expect(getInitials("Anna Maria Lopez")).toBe("AL");
  });

  it("skips punctuation, digits and symbols, keeping Thai and Latin letters", () => {
    // A real group chat title: "(A0)", "2" and "·" are not words that start with a letter.
    expect(getInitials("English · Primary Origins 2 (A0)")).toBe("EO");
    expect(getInitials("· Mai")).toBe("M");
    expect(getInitials("(Mai) Smith")).toBe("S");
    expect(getInitials("John Smith (P.1)")).toBe("JS");
    expect(getInitials("2 กล้า")).toBe("ก");
    expect(getInitials("฿500 ใบเตย")).toBe("บ");
    expect(getInitials("English · ครูนก")).toBe("E");
    for (const name of ["English · Primary Origins 2 (A0)", "John Smith (P.1)", "· Mai"]) {
      expect(getInitials(name)).toMatch(/^[A-Z]{1,2}$/);
    }
  });

  it("finds letters behind a glued emoji, quote, bracket or @ (LINE display names)", () => {
    expect(getInitials("🌸Ploy")).toBe("P");
    expect(getInitials("✨มายด์✨")).toBe("ม");
    expect(getInitials("🌸Ploy Smith")).toBe("PS");
    expect(getInitials("👍🏽Mai")).toBe("M");
    expect(getInitials("(Ploy)")).toBe("P");
    expect(getInitials("@john")).toBe("J");
    expect(getInitials('"Mai"')).toBe("M");
    expect(getInitials("(ใบเตย)")).toBe("บ");
    // The word filter still wins when there is a plain word.
    expect(getInitials("(Mai) Smith")).toBe("S");
  });

  it("falls back to ? for empty names and names without letters", () => {
    expect(getInitials("🌸")).toBe("?");
    expect(getInitials("(123)")).toBe("?");
    expect(getInitials("123")).toBe("?");
    expect(getInitials("· (2)")).toBe("?");

    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
    expect(getInitials(null)).toBe("?");
  });
});

describe("getAvatarTone", () => {
  it("is deterministic and always a known tone", () => {
    expect(getAvatarTone("สมชาย")).toBe(getAvatarTone("สมชาย"));
    for (const name of ["a", "b", "เอก", "John", ""]) {
      expect(AVATAR_TONES).toContain(getAvatarTone(name));
    }
  });
});
