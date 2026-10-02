import { describe, expect, it } from "vitest";
import { formatRankOf, getRankMeta } from "./rankMeta";

describe("getRankMeta", () => {
  it("gives medals and distinct tones to the podium", () => {
    expect(getRankMeta(1)).toMatchObject({ rank: 1, hasRank: true, emoji: "🥇", tone: "amber", label: "อันดับ 1" });
    expect(getRankMeta(2)).toMatchObject({ emoji: "🥈", tone: "blue", label: "อันดับ 2" });
    expect(getRankMeta(3)).toMatchObject({ emoji: "🥉", tone: "pink", label: "อันดับ 3" });
  });

  it("uses the number (no medal) after the podium", () => {
    expect(getRankMeta(7)).toMatchObject({ rank: 7, hasRank: true, emoji: null, tone: "neutral", label: "อันดับ 7" });
  });

  it("treats missing, zero, negative and NaN ranks as no rank", () => {
    for (const value of [undefined, null, 0, -1, Number.NaN]) {
      expect(getRankMeta(value)).toMatchObject({ rank: 0, hasRank: false, emoji: null, label: "" });
    }
  });

  it("keeps the wrap-up celebration titles", () => {
    expect(getRankMeta(1).title).toBe("ชนะเลิศอันดับ 1!");
    expect(getRankMeta(2).title).toBe("รองชนะเลิศอันดับ 1");
    expect(getRankMeta(3).title).toBe("รองชนะเลิศอันดับ 2");
    expect(getRankMeta(4).title).toBe(getRankMeta(0).title);
  });
});

describe("formatRankOf", () => {
  it("shows the class size only when it is known", () => {
    expect(formatRankOf(2, 4)).toBe("2/4");
    expect(formatRankOf(2, 0)).toBe("2");
    expect(formatRankOf(2, undefined)).toBe("2");
  });
});
