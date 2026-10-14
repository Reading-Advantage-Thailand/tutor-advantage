import { describe, expect, it } from "vitest";
import { AVATAR_TONES, getAvatarTone, getInitials } from "./avatarInitials";

describe("getInitials", () => {
  it("keeps a Thai leading vowel with its consonant", () => {
    expect(getInitials("เอก")).toBe("เอ");
    expect(getInitials("ไอซ์ ใจดี")).toBe("ไอ");
    expect(getInitials("แพรว")).toBe("แพ");
  });

  it("uses the first consonant (with vowel marks, without tone marks) for Thai", () => {
    expect(getInitials("สมชาย ใจดี")).toBe("ส");
    expect(getInitials("น้ำ")).toBe("น");
    expect(getInitials("มิว")).toBe("มิ");
  });

  it("uses first and last initials for Latin names", () => {
    expect(getInitials("john smith")).toBe("JS");
    expect(getInitials("  Mai  ")).toBe("M");
    expect(getInitials("Anna Maria Lopez")).toBe("AL");
  });

  it("falls back to ? for empty names", () => {
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
